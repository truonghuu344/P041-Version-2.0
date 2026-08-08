from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from src.agents.state import GapAnalysisState
from src.agents.tools.career_tools import (
    TECH_SKILLS,
    build_gap_evidence,
    deterministic_cv_suggestions,
    extract_known_terms,
)
from src.config import get_settings

logger = logging.getLogger(__name__)


def _json_object(content: Any) -> dict[str, Any]:
    text = str(content or "").strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1)
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("LLM response must be a JSON object")
    return value


async def validate_gap_input(state: GapAnalysisState) -> dict[str, Any]:
    cv_text = (state.get("cv_raw_text") or "").strip()
    jd_title = (state.get("jd_title") or "").strip()
    jd_requirements = (state.get("jd_requirements") or "").strip()
    if not cv_text:
        return {"error": "CV không có nội dung để phân tích."}
    if not jd_title or not jd_requirements:
        return {"error": "JD không có đủ chức danh hoặc yêu cầu công việc."}
    return {"error": ""}


async def extract_gap_evidence(state: GapAnalysisState) -> dict[str, Any]:
    evidence = build_gap_evidence(
        cv_text=state["cv_raw_text"],
        parsed=state.get("cv_parsed_json", {}),
        jd_title=state["jd_title"],
        jd_requirements=state["jd_requirements"],
    )
    return {"evidence": evidence}


async def draft_gap_analysis(state: GapAnalysisState) -> dict[str, Any]:
    evidence = state["evidence"]
    fallback = {"suggestions": deterministic_cv_suggestions(state["cv_raw_text"], evidence["hard_skills_matching"])}
    settings = get_settings()
    if not settings.openai_api_key:
        return {"draft_result": fallback}

    system_prompt = """Bạn là CV Gap Analysis Agent. Hãy đề xuất tối đa 3 cách diễn đạt lại CV theo JD.
RÀNG BUỘC LIÊM CHÍNH:
- original_text phải là câu trích nguyên văn từ CV.
- Không thêm kỹ năng, công ty, dự án, chức danh, bằng cấp, số liệu hoặc thành tích không xuất hiện trong CV.
- Kỹ năng CV còn thiếu chỉ là khoảng trống học tập, tuyệt đối không chèn vào câu tối ưu.
Trả về JSON thuần: {"suggestions":[{"original_text":"...","suggested_improvement":"...","action_verb":"...","reason":"..."}]}"""
    user_prompt = json.dumps(
        {
            "cv": state["cv_raw_text"],
            "jd_title": state["jd_title"],
            "jd_requirements": state["jd_requirements"],
            "verified_matching_skills": evidence["hard_skills_matching"],
            "missing_skills_do_not_insert": evidence["hard_skills_missing"],
        },
        ensure_ascii=False,
    )
    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.2,
            api_key=settings.openai_api_key,
        )
        response = await llm.ainvoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
        return {"draft_result": _json_object(response.content)}
    except Exception as exc:
        logger.warning("Gap Analysis Agent dùng fallback do lỗi LLM: %s", exc)
        return {"draft_result": fallback}


def _contains_missing_skill(text: str, missing_skills: list[str]) -> bool:
    return any(re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", text, flags=re.IGNORECASE) for skill in missing_skills)


def _adds_unverified_claims(improved: str, original: str, cv_skills: list[str]) -> bool:
    verified_skills = {skill.casefold() for skill in cv_skills}
    introduced_skills = extract_known_terms(improved, TECH_SKILLS)
    if any(skill.casefold() not in verified_skills for skill in introduced_skills):
        return True

    original_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", original))
    improved_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", improved))
    return not improved_numbers.issubset(original_numbers)


async def enforce_gap_integrity(state: GapAnalysisState) -> dict[str, Any]:
    evidence = state["evidence"]
    cv_text = state["cv_raw_text"]
    accepted: list[dict[str, Any]] = []
    for item in state.get("draft_result", {}).get("suggestions", []):
        if not isinstance(item, dict):
            continue
        original = str(item.get("original_text", "")).strip()
        improved = str(item.get("suggested_improvement", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if not original or original.casefold() not in cv_text.casefold():
            continue
        if not improved or _contains_missing_skill(improved, evidence["hard_skills_missing"]):
            continue
        if _adds_unverified_claims(improved, original, evidence["cv_skills"]):
            continue
        accepted.append(
            {
                "original_text": original,
                "suggested_improvement": improved,
                "action_verb": str(item.get("action_verb") or "Thực hiện"),
                "reason": reason or "Tối ưu cách diễn đạt dựa trên bằng chứng trong CV.",
            }
        )
        if len(accepted) == 3:
            break

    if not accepted:
        accepted = deterministic_cv_suggestions(cv_text, evidence["hard_skills_matching"])

    result = {
        "match_score": evidence["match_score"],
        "hard_skills_matching": evidence["hard_skills_matching"],
        "hard_skills_missing": evidence["hard_skills_missing"],
        "soft_skills_gap": evidence["soft_skills_gap"],
        "suggestions": accepted,
        "score_breakdown": evidence["score_breakdown"],
        "integrity_guardrail": "passed",
    }
    return {"gap_analysis_result": result}
