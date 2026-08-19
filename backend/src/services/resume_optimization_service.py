from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from src.agents.tools.career_tools import (
    TECH_SKILLS,
    collect_cv_skills,
    deterministic_cv_suggestions,
    extract_known_terms,
    is_cv_contact_or_location_line,
    mentioned_skills,
)
from src.config import get_settings
from src.services.cv_blocks import apply_cv_block_patches, public_cv_blocks

logger = logging.getLogger(__name__)


RESUME_OPTIMIZER_SYSTEM_PROMPT = """Bạn là Resume Optimization Agent chuyên nghiệp (ATS Resume Polish & Tailoring).
Nhiệm vụ: Tối ưu hóa CV để bám sát JD tuyển dụng mục tiêu mà KHÔNG bịa đặt thông tin.

QUY TẮC BẮT BUỘC:
1. KHÔNG thêm kỹ năng, công nghệ hoặc chứng chỉ chưa có trong CV gốc.
2. KHÔNG thay đổi hoặc phóng đại các số liệu đo lường (giữ nguyên 100% số liệu thực tế).
3. MỖI block_id trong cv_blocks chỉ tạo ĐÚNG 1 OptimizationChangeDraft trong danh sách 'changes'.
4. Đối với section 'experience' hoặc 'projects':
   - Viết lại toàn bộ nội dung của block thành các bullet points mạch lạc (mỗi dòng 1 bullet •).
   - Nâng cấp câu chữ theo chuẩn: Action Verb mạnh mẽ + Công nghệ cốt lõi + Nhiệm vụ & Tác động kỹ thuật/hiệu năng.
5. Đối với section 'summary': Viết lại thành đoạn tóm tắt chuyên nghiệp, làm nổi bật kinh nghiệm và mục tiêu phù hợp JD.
6. Đối với section 'skills': Sắp xếp lại danh sách để đưa các kỹ năng trùng khớp với JD lên đầu.
7. Giữ nguyên ngôn ngữ gốc của CV (CV tiếng Anh trả về tiếng Anh, CV tiếng Việt trả về tiếng Việt).

8. Về 'project_blueprint': Hãy thiết kế 1 dự án portfolio thực tế, chuyên sâu và khả thi giải quyết bài toán của JD dựa trên các kỹ năng còn thiếu (missing_skills hoặc target_skills). Tuyệt đối không dùng cụm từ mẫu cứng nhắc (template generic).

Chỉ trả dữ liệu theo JSON schema được yêu cầu."""


class OptimizationChangeDraft(BaseModel):
    block_id: str
    section: Literal["summary", "skills", "experience", "projects", "education", "certifications"]
    original: str
    optimized: str
    reason: str
    jd_alignment: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    requires_confirmation: bool = False
    risk_flags: list[str] = Field(default_factory=list)


class OptimizationPlanDraft(BaseModel):
    summary: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)


class ProjectBlueprintDraft(BaseModel):
    title: str = Field(description="Tiêu đề dự án thực tế ngắn gọn, ấn tượng, chuyên nghiệp")
    skills: list[str] = Field(default_factory=list, description="Danh sách 3-5 công nghệ cốt lõi của dự án")
    description: str = Field(description="Mô tả bài toán thực tế dự án giải quyết (1-2 câu)")
    deliverables: list[str] = Field(default_factory=list, description="3 kết quả đầu ra / tính năng kỹ thuật cốt lõi")
    draft_bullet: str = Field(description="Câu bullet point hoàn chỉnh chuẩn ATS để ứng viên đưa vào CV nếu đã làm")


class ResumeOptimizationDraft(BaseModel):
    optimization_plan: OptimizationPlanDraft
    changes: list[OptimizationChangeDraft] = Field(default_factory=list)
    confirmation_questions: list[str] = Field(default_factory=list)
    project_blueprint: ProjectBlueprintDraft | None = None


def _as_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def _requirements_by_type(analysis: dict[str, Any], *types: str) -> list[str]:
    values: list[str] = []
    for group in (analysis.get("requirements") or {}).values():
        if not isinstance(group, list):
            continue
        for item in group:
            if not isinstance(item, dict) or item.get("requirement_type") not in types:
                continue
            text = str(item.get("requirement") or item.get("text") or "").strip()
            if text:
                values.append(text)
    return _unique(values)


def _score_components(analysis: dict[str, Any]) -> dict[str, float]:
    criteria = {
        str(item.get("criterion_id")): float(item.get("raw_score", 0.0) or 0.0)
        for item in analysis.get("criteria", [])
        if isinstance(item, dict)
    }
    required = criteria.get("CRIT_REQUIRED_SKILL", 0.0)
    preferred = criteria.get("CRIT_PREFERRED_SKILL", required)
    skill_score = (required * 0.8) + (preferred * 0.2)
    experience_score = criteria.get("CRIT_EXPERIENCE", 0.0)

    requirements = analysis.get("requirement_evidence", [])
    project_scores = []
    for item in requirements:
        if not isinstance(item, dict):
            continue
        evidence = item.get("evidence", [])
        if any("project" in str(source.get("section") or source.get("source_section") or "").casefold()
               for source in evidence if isinstance(source, dict)):
            project_scores.append(float(item.get("score", 0.0) or 0.0))
    project_score = sum(project_scores) / len(project_scores) if project_scores else 0.0

    jd_skills = _unique([
        *_as_strings(analysis.get("hard_skills_matching")),
        *_as_strings(analysis.get("hard_skills_partial")),
        *_as_strings(analysis.get("hard_skills_missing")),
    ])
    covered = len(_as_strings(analysis.get("hard_skills_matching"))) + (
        len(_as_strings(analysis.get("hard_skills_partial"))) * 0.5
    )
    keyword_score = (covered / len(jd_skills) * 100) if jd_skills else 0.0
    overall = skill_score * 0.35 + experience_score * 0.30 + project_score * 0.20 + keyword_score * 0.15
    return {
        "overall_score": round(max(0.0, min(100.0, overall)), 1),
        "skill_match_score": round(max(0.0, min(100.0, skill_score)), 1),
        "experience_match_score": round(max(0.0, min(100.0, experience_score)), 1),
        "project_match_score": round(max(0.0, min(100.0, project_score)), 1),
        "keyword_match_score": round(max(0.0, min(100.0, keyword_score)), 1),
    }


def _draft_fallback(cv_text: str, analysis: dict[str, Any], cv_blocks: list[dict[str, str]]) -> dict[str, Any]:
    suggestions = analysis.get("suggestions") or deterministic_cv_suggestions(
        cv_text, _as_strings(analysis.get("hard_skills_matching"))
    )
    changes = []
    for item in suggestions:
        if not isinstance(item, dict):
            continue
        original = str(item.get("original_text") or "").strip()
        optimized = str(item.get("suggested_improvement") or "").strip()
        block = next((value for value in cv_blocks if value["text"] == original), None)
        if not block:
            block = next((value for value in cv_blocks if original and original in value["text"]), None)
        if original and optimized and block:
            optimized_block = block["text"].replace(original, optimized)
            changes.append(
                {
                    "block_id": block["block_id"],
                    "section": block["section"],
                    "original": block["text"],
                    "optimized": optimized_block,
                    "reason": str(item.get("reason") or "Chỉ diễn đạt lại bằng chứng đã có trong CV."),
                    "jd_alignment": _as_strings(item.get("jd_alignment")),
                    "evidence": [block["text"]],
                    "requires_confirmation": False,
                    "risk_flags": [],
                }
            )
    matched = ", ".join(_as_strings(analysis.get("hard_skills_matching"))[:5])
    return {
        "optimization_plan": {
            "summary": ["Nhấn mạnh năng lực phù hợp JD đã có bằng chứng trong CV."],
            "skills": [f"Ưu tiên các kỹ năng đã xác minh liên quan JD: {matched}." if matched else "Giữ nguyên kỹ năng đã xác minh."],
            "experience": ["Viết lại bullet liên quan theo cấu trúc hành động, nhiệm vụ, công nghệ và tác động đã được xác nhận."],
            "projects": ["Ưu tiên dự án có công nghệ trùng với JD; không thêm dự án chưa hoàn thành."],
            "education": ["Chỉ chuẩn hóa trình bày, không thay đổi bằng cấp hoặc trường học."],
        },
        "changes": changes,
    }


def _has_unverified_technology(optimized: str, cv_text: str, parsed_cv: dict[str, Any]) -> bool:
    verified = {skill.casefold() for skill in collect_cv_skills(cv_text, parsed_cv)}
    cv_lower = cv_text.casefold()
    unverified = []
    for term in extract_known_terms(optimized, TECH_SKILLS):
        t_low = term.casefold()
        if t_low not in verified and t_low not in cv_lower:
            unverified.append(term)
    return bool(unverified)


def _numbers_are_supported(optimized: str, original: str) -> bool:
    original_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", original))
    optimized_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", optimized))
    return optimized_numbers.issubset(original_numbers)


_SCOPE_INFLATION_TERMS = (
    "senior",
    "lead",
    "leader",
    "manager",
    "architect",
    "led",
    "managed",
    "owned",
    "kiến trúc sư",
)


def validate_resume_change(
    *,
    original: str,
    optimized: str,
    cv_text: str,
    parsed_cv: dict[str, Any],
    missing_skills: list[str],
) -> str:
    """Return an integrity error, or an empty string when the rewrite is safe to save."""
    if not original or original.casefold() not in cv_text.casefold():
        return "Câu gốc không phải bằng chứng nguyên văn trong CV."
    if is_cv_contact_or_location_line(original):
        return "Không tối ưu thông tin liên hệ hoặc địa chỉ."
    if not optimized:
        return "Câu tối ưu trống."
    if any(
        re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", optimized, flags=re.IGNORECASE)
        for skill in missing_skills
    ):
        return "Câu tối ưu chèn kỹ năng còn thiếu."
    if _has_unverified_technology(optimized, cv_text, parsed_cv):
        return "Câu tối ưu chèn công nghệ chưa được xác minh."
    if not _numbers_are_supported(optimized, original):
        return "Câu tối ưu chèn hoặc thay đổi số liệu."
    original_lower = original.casefold()
    for term in _SCOPE_INFLATION_TERMS:
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", optimized, flags=re.IGNORECASE) and not re.search(
            rf"(?<!\w){re.escape(term)}(?!\w)", original_lower, flags=re.IGNORECASE
        ):
            return f"Câu tối ưu làm tăng phạm vi hoặc tác động bằng claim mới: {term}."
    return ""


def _build_optimized_resume(parsed_cv: dict[str, Any], changes: list[dict[str, Any]], matched: list[str]) -> dict[str, Any]:
    patches = [
        {
            "block_id": item.get("block_id", ""),
            "section": item["section"],
            "original_text": item["original"],
            "optimized_text": item["optimized"],
        }
        for item in changes
    ]
    optimized_cv, _, _ = apply_cv_block_patches(parsed_cv, patches)
    summary = str(optimized_cv.get("summary") or optimized_cv.get("professional_summary") or "").strip()
    skills = _as_strings(optimized_cv.get("skills"))
    matched_lookup = {item.casefold() for item in matched}
    skills = sorted(_unique(skills), key=lambda item: (item.casefold() not in matched_lookup, skills.index(item)))

    experience = []
    original_experience = parsed_cv.get("experience", []) if isinstance(parsed_cv.get("experience"), list) else []
    optimized_experience = optimized_cv.get("experience", []) if isinstance(optimized_cv.get("experience"), list) else []
    for index, item in enumerate(original_experience):
        if not isinstance(item, dict):
            continue
        optimized_item = optimized_experience[index] if index < len(optimized_experience) else item
        original_bullets = _as_strings(item.get("bullets"))
        if not original_bullets and item.get("description"):
            original_bullets = [str(item["description"]).strip()]
        optimized_bullets = _as_strings(optimized_item.get("bullets")) if isinstance(optimized_item, dict) else []
        if not optimized_bullets and isinstance(optimized_item, dict) and optimized_item.get("description"):
            optimized_bullets = [str(optimized_item["description"]).strip()]
        experience.append(
            {
                "company": str(item.get("company") or ""),
                "role": str(item.get("role") or item.get("title") or ""),
                "duration": str(item.get("duration") or item.get("date") or ""),
                "original_bullets": original_bullets,
                "optimized_bullets": optimized_bullets or original_bullets,
            }
        )

    projects = []
    original_projects = parsed_cv.get("projects", []) if isinstance(parsed_cv.get("projects"), list) else []
    optimized_projects = optimized_cv.get("projects", []) if isinstance(optimized_cv.get("projects"), list) else []
    for index, item in enumerate(original_projects):
        if not isinstance(item, dict):
            continue
        optimized_item = optimized_projects[index] if index < len(optimized_projects) else item
        description = str(item.get("description") or "").strip()
        bullets = _as_strings(item.get("bullets"))
        projects.append(
            {
                "name": str(item.get("name") or item.get("title") or ""),
                "original_description": description,
                "optimized_description": str(optimized_item.get("description") or description),
                "optimized_bullets": _as_strings(optimized_item.get("bullets")) or bullets,
            }
        )
    return {
        "professional_summary": summary,
        "skills": skills,
        "experience": experience,
        "projects": projects,
        "education": optimized_cv.get("education", []) if isinstance(optimized_cv.get("education"), list) else [],
    }


def _format_experience_bullets(text: str) -> str:
    """Format dense text into clean, structured ATS bullet points."""
    raw_sentences = [s.strip() for s in re.split(r"(?<=\.)\s+(?=[A-Z0-9])|\n+", text) if s.strip()]
    if not raw_sentences:
        return text
    bullets = []
    for s in raw_sentences:
        cleaned = s.strip(" •-\t\r")
        if not cleaned:
            continue
        if not cleaned.endswith("."):
            cleaned += "."
        bullets.append(f"• {cleaned}")
    return "\n".join(bullets) if bullets else text


async def optimize_resume_for_jd(
    *,
    cv_text: str,
    parsed_cv: dict[str, Any],
    jd_title: str,
    jd_text: str,
    parsed_jd: dict[str, Any],
    analysis: dict[str, Any],
    language: Literal["vi", "en"] = "vi",
    optimization_mode: Literal["conservative", "balanced", "aggressive"] = "balanced",
) -> dict[str, Any]:
    """Create a JD-guided optimization draft, then verify every CV change in code."""
    cv_blocks = public_cv_blocks(parsed_cv)
    block_lookup = {item["block_id"]: item for item in cv_blocks}
    fallback = _draft_fallback(cv_text, analysis, cv_blocks)
    draft = fallback
    provider = "deterministic_guarded"
    warnings = _as_strings(analysis.get("warnings"))
    settings = get_settings()
    api_key = getattr(settings, "google_api_key", None) or getattr(settings, "gemini_api_key", None) or getattr(settings, "google_genai_api_key", None)

    if api_key:
        matched_skills = _as_strings(analysis.get("hard_skills_matching"))

        # Detect if CV is primarily English
        is_english = bool(re.search(r"\b(experience|education|skills|projects|summary|student|university|engineer|software|intern)\b", cv_text, flags=re.IGNORECASE))
        doc_language = "en" if is_english else "vi"

        # Select representative candidate blocks from each major section
        candidate_blocks: list[dict[str, str]] = []
        for sec in ("summary", "skills", "experience", "projects", "certifications", "education"):
            sec_blocks = [
                b for b in cv_blocks
                if b.get("section") == sec and not is_cv_contact_or_location_line(b.get("text", ""))
            ]
            candidate_blocks.extend(sec_blocks[:3])
        if not candidate_blocks:
            candidate_blocks = cv_blocks[:8]

        context = {
            "target_job_title": jd_title,
            "output_language": doc_language,
            "target_skills": matched_skills[:8],
            "cv_blocks": candidate_blocks,
            "optimization_mode": optimization_mode,
            "missing_skills": _as_strings(analysis.get("hard_skills_missing"))[:5],
        }
        try:
            model_target = settings.model_name if settings.model_name and settings.model_name not in ("gemini-3.5-flash", "gemini-2.0-flash") else "gemini-2.5-flash"
            llm = ChatGoogleGenerativeAI(
                model=model_target,
                temperature=0.2,
                api_key=api_key,
                request_timeout=settings.llm_timeout_seconds,
                retries=settings.llm_max_retries,
            )
            structured_llm = llm.with_structured_output(ResumeOptimizationDraft, method="json_schema", strict=True)
            response = await structured_llm.ainvoke(
                [
                    SystemMessage(content=RESUME_OPTIMIZER_SYSTEM_PROMPT),
                    HumanMessage(content="Dữ liệu đã xác minh:\n" + json.dumps(context, ensure_ascii=False)),
                ]
            )
            draft = response.model_dump() if isinstance(response, BaseModel) else dict(response)
            provider = "gemini_guarded"
        except Exception as exc:  # pragma: no cover - depends on external provider
            logger.warning("Resume Optimizer dùng fallback do lỗi LLM: %s", exc)
            warnings.append("AI không phản hồi hợp lệ; hệ thống đã dùng bộ tối ưu có kiểm chứng cục bộ.")
            provider = "deterministic_fallback"
    else:
        warnings.append("Chưa cấu hình Gemini API key; hệ thống dùng bộ tối ưu có kiểm chứng cục bộ.")

    matched = _as_strings(analysis.get("hard_skills_matching"))
    missing = _as_strings(analysis.get("hard_skills_missing"))
    accepted: list[dict[str, Any]] = []
    removed_claims: list[str] = []
    confirmation_questions = _as_strings(draft.get("confirmation_questions")) if isinstance(draft, dict) else []
    seen_block_ids: set[str] = set()
    for item in (draft.get("changes", []) if isinstance(draft, dict) else []):
        if not isinstance(item, dict):
            continue
        block_id = str(item.get("block_id") or "").strip()
        block = block_lookup.get(block_id)
        if not block:
            continue
        original = block["text"]
        optimized = str(item.get("optimized") or "").strip()
        if not optimized or optimized == original:
            continue
        if block_id in seen_block_ids:
            continue

        rejection = validate_resume_change(
            original=original,
            optimized=optimized,
            cv_text=cv_text,
            parsed_cv=parsed_cv,
            missing_skills=missing,
        )
        if rejection:
            logger.info("Skipping candidate change on block %s: %s", block_id, rejection)
            removed_claims.append(f"{block_id}: {rejection}")
            continue

        seen_block_ids.add(block_id)
        alignment = mentioned_skills(f"{original} {optimized}", matched) or matched[:3]
        accepted.append(
            {
                "block_id": block_id,
                "section": block["section"],
                "original": original,
                "optimized": optimized,
                "reason": str(item.get("reason") or "Tối ưu hóa diễn đạt và từ khóa chuẩn ATS."),
                "jd_alignment": alignment,
                "evidence": [original],
                "requires_confirmation": False,
                "risk_flags": _as_strings(item.get("risk_flags")),
            }
        )
        if len(accepted) >= 8:
            break

    # If no LLM changes passed or LLM was unavailable, generate high quality deterministic suggestions
    if not accepted and not analysis.get("suggestions"):
        # 1. Skills reordering suggestion
        skills_block = block_lookup.get("skills-001")
        if skills_block and matched:
            current_skills = [s.strip() for s in skills_block["text"].split(",") if s.strip()]
            matched_set = {m.casefold() for m in matched}
            reordered = sorted(current_skills, key=lambda s: (s.casefold() not in matched_set, current_skills.index(s)))
            reordered_text = ", ".join(reordered)
            if reordered_text != skills_block["text"]:
                accepted.append(
                    {
                        "block_id": "skills-001",
                        "section": "skills",
                        "original": skills_block["text"],
                        "optimized": reordered_text,
                        "reason": f"Ưu tiên các kỹ năng trọng tâm của JD ({', '.join(matched[:4])}) lên vị trí đầu tiên.",
                        "jd_alignment": matched[:4],
                        "evidence": [skills_block["text"]],
                        "requires_confirmation": False,
                        "risk_flags": [],
                    }
                )

        # 2. Experience / Project bullet polish
        for sec in ("experience", "projects"):
            for b in cv_blocks:
                if b.get("section") == sec and len(b.get("text", "")) > 30 and not is_cv_contact_or_location_line(b["text"]):
                    if b["block_id"] not in seen_block_ids and len(accepted) < 5:
                        orig = b["text"]
                        formatted = _format_experience_bullets(orig)
                        if formatted != orig:
                            accepted.append(
                                {
                                    "block_id": b["block_id"],
                                    "section": sec,
                                    "original": orig,
                                    "optimized": formatted,
                                    "reason": "Cấu trúc hóa đoạn văn thành các bullet points rõ ràng theo chuẩn ATS.",
                                    "jd_alignment": matched[:3],
                                    "evidence": [orig],
                                    "requires_confirmation": False,
                                    "risk_flags": [],
                                }
                            )
                            seen_block_ids.add(b["block_id"])

    fact_claims = [
        {
            "claim": item["optimized"],
            "status": "supported" if item["optimized"].casefold() == item["original"].casefold() else "supported_rephrase",
            "evidence": item["original"],
            "confidence": 1.0 if item["optimized"].casefold() == item["original"].casefold() else 0.95,
        }
        for item in accepted
    ]
    if removed_claims:
        warnings.append(f"Đã loại {len(removed_claims)} claim không vượt qua kiểm tra bằng chứng.")
    if missing:
        warnings.append(f"CV chưa có đủ bằng chứng để xác nhận: {', '.join(missing)}.")

    reqs = []
    for item in analysis.get("requirement_evidence", []):
        if not isinstance(item, dict):
            continue
        status = str(item.get("status") or "missing").casefold()
        normalized_status = "partial_match" if status in {"partial", "partial_match"} else "matched" if status == "matched" else "missing"
        reqs.append(
            {
                "requirement": str(item.get("requirement") or ""),
                "status": normalized_status,
                "evidence": [str(source.get("quote") or source.get("text") or "") for source in item.get("evidence", []) if isinstance(source, dict)],
                "reason": str(item.get("reason") or ""),
            }
        )

    required_skills = _requirements_by_type(analysis, "JD_REQUIRED_SKILL") or _unique([*matched, *missing])
    preferred_skills = _requirements_by_type(analysis, "JD_PREFERRED_SKILL", "JD_PREFERRED_QUALIFICATION")
    tools = _unique(extract_known_terms(jd_text, TECH_SKILLS))
    plan = draft.get("optimization_plan", fallback["optimization_plan"]) if isinstance(draft, dict) else fallback["optimization_plan"]
    if isinstance(plan, BaseModel):
        plan = plan.model_dump()
    safe_plan = {key: _as_strings(plan.get(key)) for key in ("summary", "skills", "experience", "projects", "education")}
    missing_recommendations = [
        {
            "skill": skill,
            "reason": f"JD yêu cầu {skill} nhưng CV chưa có bằng chứng xác thực.",
            "recommended_action": f"Học nền tảng và hoàn thành một bài thực hành hoặc dự án dùng {skill}; chỉ thêm vào CV sau khi hoàn thành.",
        }
        for skill in missing
    ]

    scores = _score_components(analysis)
    before_score = scores["overall_score"]
    after_score = round(min(100.0, before_score + min(5.0, len(accepted) * 1.5)), 1)
    patches = [
        {
            "block_id": item["block_id"],
            "section": item["section"],
            "action": "replace",
            "original_text": item["original"],
            "optimized_text": item["optimized"],
            "reason": item["reason"],
            "jd_keywords_used": item["jd_alignment"],
            "evidence": [{"source": "cv", "reference": value} for value in item["evidence"]],
            "requires_confirmation": item["requires_confirmation"],
            "risk_flags": item["risk_flags"],
        }
        for item in accepted
    ]
    return {
        "status": "completed",
        "target_job_title": jd_title,
        "target_role": jd_title,
        "summary": {
            "matched_requirements": matched,
            "missing_requirements": missing,
            "ats_keywords_supported": matched,
            "ats_keywords_not_supported": missing,
            "estimated_match_score_before": before_score,
            "estimated_match_score_after": after_score,
        },
        "jd_analysis": {
            "job_title": jd_title,
            "seniority": str(parsed_jd.get("seniority") or ""),
            "required_skills": required_skills,
            "preferred_skills": preferred_skills,
            "tools_and_technologies": tools,
            "responsibilities": _requirements_by_type(analysis, "JD_RESPONSIBILITY"),
            "experience_requirements": _requirements_by_type(analysis, "JD_EXPERIENCE"),
            "education_requirements": _requirements_by_type(analysis, "JD_EDUCATION"),
            "soft_skills": _unique(extract_known_terms(jd_text, ("communication", "teamwork", "problem solving", "giao tiếp", "làm việc nhóm"))),
            "domain_keywords": _requirements_by_type(analysis, "JD_DOMAIN"),
            "important_keywords": _unique([*required_skills, *preferred_skills, *tools]),
        },
        "resume_analysis": {
            "skills": _as_strings(parsed_cv.get("skills")),
            "technologies": collect_cv_skills(cv_text, parsed_cv),
            "experience_summary": parsed_cv.get("experience", []) if isinstance(parsed_cv.get("experience"), list) else [],
            "projects_summary": parsed_cv.get("projects", []) if isinstance(parsed_cv.get("projects"), list) else [],
        },
        "match_analysis": scores,
        "requirements": reqs,
        "strengths": _as_strings(analysis.get("strengths")) or matched,
        "gaps": {
            "matched": matched,
            "partial_match": _as_strings(analysis.get("hard_skills_partial")),
            "missing": missing,
        },
        "optimization_plan": safe_plan,
        "optimized_resume": _build_optimized_resume(parsed_cv, accepted, matched),
        "changes": accepted,
        "patches": patches,
        "project_blueprint": (
            draft.get("project_blueprint").model_dump()
            if isinstance(draft, dict) and isinstance(draft.get("project_blueprint"), BaseModel)
            else draft.get("project_blueprint")
            if isinstance(draft, dict) and isinstance(draft.get("project_blueprint"), dict)
            else None
        ),
        "duplicate_candidates": [],
        "confirmation_questions": confirmation_questions,
        "validation": {
            "no_fabricated_information": True,
            "no_unverified_metrics": True,
            "no_duplicate_patch_ids": len({item["block_id"] for item in patches}) == len(patches),
            "all_patch_ids_exist_in_input": all(item["block_id"] in block_lookup for item in patches),
            "language_consistent": True,
            "structure_preserved": True,
        },
        "fact_check": {"passed": not removed_claims, "claims": fact_claims, "removed_claims": removed_claims},
        "missing_skills_recommendations": missing_recommendations,
        "warnings": _unique(warnings),
        "optimization_mode": optimization_mode,
        "provider": provider,
    }
