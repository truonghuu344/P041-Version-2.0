from __future__ import annotations

import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from src.agents.state import GapAnalysisState
from src.agents.tools.career_tools import (
    TECH_SKILLS,
    build_gap_evidence,
    deterministic_cv_suggestions,
    deterministic_gap_career_plan,
    extract_known_terms,
)
from src.config import get_settings

logger = logging.getLogger(__name__)


class CVRewriteDraft(BaseModel):
    original_text: str
    suggested_improvement: str
    action_verb: str
    reason: str


class PriorityActionDraft(BaseModel):
    priority: int = Field(ge=1, le=10)
    gap: str
    why_it_matters: str
    action: str


class LearningDraft(BaseModel):
    skill: str
    learning_goal: str
    topics: list[str]
    practice: str


class CertificationDraft(BaseModel):
    name: str
    provider: str
    related_skills: list[str]
    level: str
    reason: str
    verification_note: str


class ProjectDraft(BaseModel):
    title: str
    objective: str
    skills: list[str]
    deliverables: list[str]
    cv_bullet_template: str
    status: str


class CVSectionDraft(BaseModel):
    section: str
    issue: str
    recommendation: str


class GapCareerPlanDraft(BaseModel):
    executive_summary: str
    priority_actions: list[PriorityActionDraft]
    learning_recommendations: list[LearningDraft]
    certification_recommendations: list[CertificationDraft]
    project_recommendations: list[ProjectDraft]
    cv_section_recommendations: list[CVSectionDraft]
    suggestions: list[CVRewriteDraft]


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
    fallback = {
        **deterministic_gap_career_plan(evidence, state["jd_title"]),
        "suggestions": deterministic_cv_suggestions(state["cv_raw_text"], evidence["hard_skills_matching"]),
    }
    settings = get_settings()
    if not settings.google_genai_api_key:
        return {"draft_result": fallback}

    system_prompt = """Bạn là CV Gap Analysis & Career Action Plan Agent.
Hãy so sánh bằng chứng CV với JD và tạo kế hoạch cụ thể gồm:
- việc cần ưu tiên để đáp ứng JD;
- nội dung/kỹ năng cần học và bài thực hành;
- tối đa 3 chứng chỉ liên quan;
- tối đa 3 dự án portfolio nên thực hiện;
- mục CV cần bổ sung hoặc viết rõ hơn;
- tối đa 3 cách diễn đạt lại bullet CV.

RÀNG BUỘC LIÊM CHÍNH:
- original_text phải là câu trích nguyên văn từ CV.
- Không thêm kỹ năng, công ty, dự án, chức danh, bằng cấp, số liệu hoặc thành tích không xuất hiện trong CV.
- Kỹ năng CV còn thiếu chỉ là khoảng trống học tập, tuyệt đối không chèn vào câu tối ưu.
- Chứng chỉ và dự án là KHUYẾN NGHỊ TƯƠNG LAI, không được mô tả như ứng viên đã hoàn thành.
- Project status luôn là recommended_not_completed; bullet template phải bắt đầu bằng 'Sau khi hoàn thành:'.
- Chỉ đề xuất nội dung liên quan trực tiếp tới kỹ năng/yêu cầu trong JD.
- Với chứng chỉ, luôn nhắc người dùng kiểm tra thông tin hiện hành trên trang nhà cung cấp."""
    user_prompt = f"""CV:
{state['cv_raw_text']}

JD title: {state['jd_title']}
JD requirements: {state['jd_requirements']}
Verified matching skills: {evidence['hard_skills_matching']}
Missing skills: {evidence['hard_skills_missing']}
Soft-skill gaps: {evidence['soft_skills_gap']}
"""
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            temperature=1.0,
            api_key=settings.google_genai_api_key,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )
        structured_llm = llm.with_structured_output(GapCareerPlanDraft, method="json_schema", strict=True)
        response = await structured_llm.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        )
        value = response.model_dump() if isinstance(response, BaseModel) else dict(response)
        return {"draft_result": value}
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

    fallback_plan = deterministic_gap_career_plan(evidence, state["jd_title"])
    draft = state.get("draft_result", {})
    missing_lookup = {skill.casefold(): skill for skill in evidence["hard_skills_missing"]}
    jd_lookup = {skill.casefold(): skill for skill in evidence["jd_skills"]}
    valid_gap_lookup = {
        **missing_lookup,
        **{skill.casefold(): skill for skill in evidence["soft_skills_gap"]},
    }

    priority_actions = []
    for item in draft.get("priority_actions", []):
        if not isinstance(item, dict):
            continue
        gap_key = str(item.get("gap", "")).strip().casefold()
        if gap_key not in valid_gap_lookup:
            continue
        priority_actions.append(
            {
                "priority": len(priority_actions) + 1,
                "gap": valid_gap_lookup[gap_key],
                "why_it_matters": str(item.get("why_it_matters", "")).strip(),
                "action": str(item.get("action", "")).strip(),
            }
        )
        if len(priority_actions) == 7:
            break

    learning_recommendations = []
    for item in draft.get("learning_recommendations", []):
        if not isinstance(item, dict):
            continue
        skill = str(item.get("skill", "")).strip()
        if skill.casefold() not in missing_lookup:
            continue
        learning_recommendations.append(
            {
                "skill": missing_lookup[skill.casefold()],
                "learning_goal": str(item.get("learning_goal", "")).strip(),
                "topics": [str(topic).strip() for topic in item.get("topics", []) if str(topic).strip()][:6],
                "practice": str(item.get("practice", "")).strip(),
            }
        )

    certification_recommendations = []
    for item in draft.get("certification_recommendations", []):
        if not isinstance(item, dict):
            continue
        related = [
            jd_lookup[str(skill).casefold()]
            for skill in item.get("related_skills", [])
            if str(skill).casefold() in jd_lookup
        ]
        if not related:
            continue
        certification_recommendations.append(
            {
                "name": str(item.get("name", "")).strip(),
                "provider": str(item.get("provider", "")).strip(),
                "related_skills": related,
                "level": str(item.get("level", "")).strip(),
                "reason": str(item.get("reason", "")).strip(),
                "verification_note": "Kiểm tra điều kiện, lệ phí và phiên bản trên trang chính thức trước khi đăng ký.",
            }
        )
        if len(certification_recommendations) == 3:
            break

    project_recommendations = []
    for item in draft.get("project_recommendations", []):
        if not isinstance(item, dict):
            continue
        skills = [
            jd_lookup[str(skill).casefold()]
            for skill in item.get("skills", [])
            if str(skill).casefold() in jd_lookup
        ]
        if not skills or (missing_lookup and not any(skill.casefold() in missing_lookup for skill in skills)):
            continue
        bullet = str(item.get("cv_bullet_template", "")).strip()
        if not bullet.casefold().startswith("sau khi hoàn thành:"):
            bullet = f"Sau khi hoàn thành: {bullet}"
        project_recommendations.append(
            {
                "title": str(item.get("title", "")).strip(),
                "objective": str(item.get("objective", "")).strip(),
                "skills": skills,
                "deliverables": [
                    str(value).strip() for value in item.get("deliverables", []) if str(value).strip()
                ][:6],
                "cv_bullet_template": bullet,
                "status": "recommended_not_completed",
            }
        )
        if len(project_recommendations) == 3:
            break

    allowed_sections = {"summary", "skills", "projects", "experience", "education", "certifications"}
    cv_section_recommendations = []
    for item in draft.get("cv_section_recommendations", []):
        if not isinstance(item, dict):
            continue
        section = str(item.get("section", "")).strip()
        normalized_section = section.casefold().split(" /")[0]
        if normalized_section not in allowed_sections:
            continue
        cv_section_recommendations.append(
            {
                "section": section,
                "issue": str(item.get("issue", "")).strip(),
                "recommendation": str(item.get("recommendation", "")).strip(),
            }
        )

    result = {
        "match_score": evidence["match_score"],
        "hard_skills_matching": evidence["hard_skills_matching"],
        "hard_skills_missing": evidence["hard_skills_missing"],
        "soft_skills_gap": evidence["soft_skills_gap"],
        "suggestions": accepted,
        "executive_summary": fallback_plan["executive_summary"],
        "priority_actions": priority_actions or fallback_plan["priority_actions"],
        "learning_recommendations": learning_recommendations or fallback_plan["learning_recommendations"],
        "certification_recommendations": (
            certification_recommendations or fallback_plan["certification_recommendations"]
        ),
        "project_recommendations": project_recommendations or fallback_plan["project_recommendations"],
        "cv_section_recommendations": cv_section_recommendations or fallback_plan["cv_section_recommendations"],
        "score_breakdown": evidence["score_breakdown"],
        "integrity_guardrail": "passed",
    }
    return {"gap_analysis_result": result}
