"""Deterministic explanation generator for Top Jobs recommendations.

Generates structured, auditable, and i18n-friendly reason codes for strengths
and gaps without relying on non-deterministic LLM generation.

Example Strength Item:
{
  "code": "STRONG_REQUIRED_SKILLS",
  "criterion": "required_skills",
  "evidence_ids": ["ev1", "ev2"],
  "message_vi": "Kỹ năng bắt buộc được hỗ trợ tốt bởi CV",
  "message_en": "Required skills are strongly supported by the CV"
}

Example Gap Item:
{
  "code": "MISSING_REQUIRED_SKILL",
  "requirement_id": "req_redis",
  "requirement_text": "Redis",
  "mandatory": true,
  "message_vi": "Chưa tìm thấy evidence cho Redis",
  "message_en": "Missing evidence for Redis"
}
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class StrengthItem:
    """A structured strength indicator."""

    code: str
    criterion: str | None = None
    requirement_id: str | None = None
    requirement_text: str | None = None
    evidence_ids: list[str] = field(default_factory=list)
    message_vi: str = ""
    message_en: str = ""

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "code": self.code,
            "evidence_ids": self.evidence_ids,
            "message_vi": self.message_vi,
            "message_en": self.message_en,
        }
        if self.criterion:
            data["criterion"] = self.criterion
        if self.requirement_id:
            data["requirement_id"] = self.requirement_id
        if self.requirement_text:
            data["requirement_text"] = self.requirement_text
        return data


@dataclass(frozen=True, slots=True)
class GapItem:
    """A structured gap indicator."""

    code: str
    criterion: str | None = None
    requirement_id: str | None = None
    requirement_text: str | None = None
    mandatory: bool = False
    message_vi: str = ""
    message_en: str = ""

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "code": self.code,
            "mandatory": self.mandatory,
            "message_vi": self.message_vi,
            "message_en": self.message_en,
        }
        if self.criterion:
            data["criterion"] = self.criterion
        if self.requirement_id:
            data["requirement_id"] = self.requirement_id
        if self.requirement_text:
            data["requirement_text"] = self.requirement_text
        return data


@dataclass(frozen=True, slots=True)
class ExplanationResult:
    """Full deterministic explanation payload."""

    top_strengths: list[str]
    top_gaps: list[str]
    strengths: list[dict[str, Any]]
    gaps: list[dict[str, Any]]
    explanation_json: dict[str, Any]


def generate_deterministic_explanations(
    match_or_result: Any,
    *,
    max_strengths: int = 4,
    max_gaps: int = 4,
    lang: str = "vi",
) -> ExplanationResult:
    """Generate structured reason codes and UI messages for match strengths and gaps.

    Parameters
    ----------
    match_or_result:
        MatchResult, MatchRun, or dictionary containing pipeline evaluation result
        (with ``criteria`` and ``requirements``).
    max_strengths:
        Maximum number of top strengths to return in UI summary list.
    max_gaps:
        Maximum number of top gaps to return in UI summary list.
    lang:
        Default language for UI summary lists ('vi' or 'en').

    Returns
    -------
    ExplanationResult
        Contains top_strengths, top_gaps, structured items, and persistence JSON.
    """
    result_json = getattr(match_or_result, "result_json", None) or (
        match_or_result.get("result_json") if isinstance(match_or_result, Mapping) else None
    )
    if result_json is None and isinstance(match_or_result, Mapping):
        result_json = match_or_result

    result_json = result_json if isinstance(result_json, Mapping) else {}

    criteria_list = result_json.get("criteria", [])
    requirements_group = result_json.get("requirements", {})

    strengths_items: list[StrengthItem] = []
    gaps_items: list[GapItem] = []

    # 1. Evaluate Criterion-Level Strengths (High-level pillars)
    if isinstance(criteria_list, Sequence) and not isinstance(criteria_list, (str, bytes)):
        for crit in criteria_list:
            if not isinstance(crit, Mapping):
                continue
            cid = str(crit.get("criterion_id", ""))
            raw = float(crit.get("raw_score", 0.0))
            e_ids = [str(eid) for eid in crit.get("evidence_ids", [])]

            if raw >= 80.0:
                if cid == "CRIT_REQUIRED_SKILL":
                    strengths_items.append(
                        StrengthItem(
                            code="STRONG_REQUIRED_SKILLS",
                            criterion="required_skills",
                            evidence_ids=e_ids[:3],
                            message_vi="Kỹ năng bắt buộc được hỗ trợ tốt bởi CV",
                            message_en="Required skills are strongly supported by the CV",
                        )
                    )
                elif cid == "CRIT_EXPERIENCE":
                    strengths_items.append(
                        StrengthItem(
                            code="STRONG_EXPERIENCE",
                            criterion="experience",
                            evidence_ids=e_ids[:3],
                            message_vi="Kinh nghiệm làm việc liên quan đáp ứng tốt yêu cầu",
                            message_en="Relevant work experience closely aligns with requirements",
                        )
                    )
                elif cid == "CRIT_EDUCATION":
                    strengths_items.append(
                        StrengthItem(
                            code="MATCHED_EDUCATION",
                            criterion="education",
                            evidence_ids=e_ids[:2],
                            message_vi="Trình độ học vấn và chuyên ngành phù hợp",
                            message_en="Educational background and major match the JD",
                        )
                    )
                elif cid == "CRIT_PREFERRED_SKILL":
                    strengths_items.append(
                        StrengthItem(
                            code="STRONG_PREFERRED_SKILLS",
                            criterion="preferred_skills",
                            evidence_ids=e_ids[:2],
                            message_vi="Đáp ứng tốt các kỹ năng ưu tiên (nice-to-have)",
                            message_en="Possesses desirable preferred skills",
                        )
                    )
                elif cid == "CRIT_DOMAIN":
                    strengths_items.append(
                        StrengthItem(
                            code="STRONG_DOMAIN",
                            criterion="domain",
                            evidence_ids=e_ids[:2],
                            message_vi="Có kinh nghiệm thực tế trong lĩnh vực của dự án",
                            message_en="Demonstrated experience in the target domain",
                        )
                    )

    # 2. Evaluate Specific Requirement-Level Strengths & Gaps
    if isinstance(requirements_group, Mapping):
        matched_reqs = requirements_group.get("matched", [])
        missing_reqs = requirements_group.get("missing", [])
        partial_reqs = requirements_group.get("partial", [])
        uncertain_reqs = requirements_group.get("uncertain", [])

        # Process Missing/Unmet requirements -> Gaps
        for req in missing_reqs:
            if not isinstance(req, Mapping):
                continue
            req_id = str(req.get("requirement_id") or req.get("id") or "")
            req_text = str(req.get("normalized_value") or req.get("text") or "")
            is_mandatory = bool(req.get("mandatory"))

            code = "MISSING_REQUIRED_SKILL" if is_mandatory else "MISSING_PREFERRED_SKILL"
            msg_vi = f"Chưa tìm thấy evidence cho {req_text}" if req_text else "Chưa tìm thấy evidence cho yêu cầu này"
            msg_en = f"Missing evidence for {req_text}" if req_text else "No evidence found for requirement"

            gaps_items.append(
                GapItem(
                    code=code,
                    criterion="required_skills" if is_mandatory else "preferred_skills",
                    requirement_id=req_id,
                    requirement_text=req_text,
                    mandatory=is_mandatory,
                    message_vi=msg_vi,
                    message_en=msg_en,
                )
            )

        # Process Partial requirements -> Gaps
        for req in partial_reqs:
            if not isinstance(req, Mapping):
                continue
            req_id = str(req.get("requirement_id") or req.get("id") or "")
            req_text = str(req.get("normalized_value") or req.get("text") or "")
            is_mandatory = bool(req.get("mandatory"))

            msg_vi = f"Kỹ năng/kinh nghiệm {req_text} chỉ đáp ứng một phần" if req_text else "Chỉ đáp ứng một phần"
            msg_en = f"Partially satisfies {req_text}" if req_text else "Partially satisfies requirement"

            gaps_items.append(
                GapItem(
                    code="PARTIAL_REQUIREMENT_MATCH",
                    requirement_id=req_id,
                    requirement_text=req_text,
                    mandatory=is_mandatory,
                    message_vi=msg_vi,
                    message_en=msg_en,
                )
            )

        # Process Uncertain requirements -> Gaps
        for req in uncertain_reqs:
            if not isinstance(req, Mapping):
                continue
            req_id = str(req.get("requirement_id") or req.get("id") or "")
            req_text = str(req.get("normalized_value") or req.get("text") or "")

            gaps_items.append(
                GapItem(
                    code="UNCERTAIN_EXTRACTION",
                    requirement_id=req_id,
                    requirement_text=req_text,
                    mandatory=bool(req.get("mandatory")),
                    message_vi=f"Dữ liệu trích xuất cho {req_text} chưa đủ độ tin cậy" if req_text else "Dữ liệu chưa rõ ràng",
                    message_en=f"Low extraction confidence for {req_text}" if req_text else "Uncertain evidence",
                )
            )

        # Process individual key matched skills if high-level strengths are few
        for req in matched_reqs:
            if not isinstance(req, Mapping):
                continue
            req_id = str(req.get("requirement_id") or "")
            req_text = str(req.get("normalized_value") or req.get("text") or "")
            e_ids = [str(eid) for eid in req.get("evidence_ids", [])]

            if req_text and not any(s.requirement_text == req_text for s in strengths_items):
                strengths_items.append(
                    StrengthItem(
                        code="SUPPORTED_REQUIREMENT",
                        requirement_id=req_id,
                        requirement_text=req_text,
                        evidence_ids=e_ids[:2],
                        message_vi=f"Đáp ứng tốt yêu cầu: {req_text}",
                        message_en=f"Strong match for: {req_text}",
                    )
                )

    # Sort gaps: mandatory failures first, then partial, then uncertain
    gaps_items.sort(key=lambda g: (not g.mandatory, g.code != "MISSING_REQUIRED_SKILL"))

    # Convert to dictionaries
    dict_strengths = [item.to_dict() for item in strengths_items]
    dict_gaps = [item.to_dict() for item in gaps_items]

    # Generate string lists for UI display
    top_strengths_str = [
        item.message_vi if lang == "vi" else item.message_en
        for item in strengths_items[:max_strengths]
    ]
    if not top_strengths_str:
        top_strengths_str = (
            ["Có sự phù hợp tổng quan với vị trí ứng tuyển."]
            if lang == "vi"
            else ["General overall compatibility with the role."]
        )

    top_gaps_str = [
        item.message_vi if lang == "vi" else item.message_en
        for item in gaps_items[:max_gaps]
    ]
    if not top_gaps_str:
        top_gaps_str = (
            ["Không phát hiện thiếu sót lớn trong các yêu cầu trọng yếu."]
            if lang == "vi"
            else ["No major gaps detected for key requirements."]
        )

    payload = {
        "strengths": dict_strengths,
        "gaps": dict_gaps,
        "summary": {
            "strengths_count": len(dict_strengths),
            "gaps_count": len(dict_gaps),
            "mandatory_gaps_count": sum(1 for g in gaps_items if g.mandatory),
        },
    }

    return ExplanationResult(
        top_strengths=top_strengths_str,
        top_gaps=top_gaps_str,
        strengths=dict_strengths,
        gaps=dict_gaps,
        explanation_json=payload,
    )
