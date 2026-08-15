"""
Gap Priority Service — Thành viên 4 (feat/match-evaluation-modal)

Sắp xếp danh sách gap theo mức độ ưu tiên xử lý:
1. Mandatory requirements bị trượt → lên đầu
2. Trong cùng nhóm → sort theo score_impact giảm dần
3. Tie-break → sort theo requirement_id tăng dần (stable/deterministic)

Không dùng LLM: action_text dùng template tĩnh để đảm bảo:
- Không hallucinate CV facts
- Không rò rỉ nội dung JD
- Không phụ thuộc network → kết quả < 1ms
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ActionType(str, Enum):
    MANDATORY_MISSING = "mandatory_missing"
    EVIDENCE_WEAK     = "evidence_weak"
    SKILL_MISSING     = "skill_missing"
    UNCERTAIN         = "uncertain"
    PREFERRED_MISSING = "preferred_missing"


# Statuses được coi là gap (loại trừ khỏi danh sách gap)
_SATISFIED_STATUSES = {"SUPPORTED"}

# Template tĩnh — không chứa data từ CV/JD
_ACTION_TEMPLATES: dict[ActionType, str] = {
    ActionType.MANDATORY_MISSING: (
        "Đây là yêu cầu bắt buộc — hãy bổ sung kinh nghiệm hoặc dự án liên quan "
        "vào phần Kinh nghiệm hoặc Dự án trong CV trước khi ứng tuyển."
    ),
    ActionType.EVIDENCE_WEAK: (
        "AI tìm thấy một số bằng chứng liên quan nhưng chưa đủ thuyết phục — "
        "hãy mô tả cụ thể hơn bằng con số, kết quả đạt được, hoặc công nghệ sử dụng."
    ),
    ActionType.SKILL_MISSING: (
        "Kỹ năng này chưa xuất hiện trong CV — nếu bạn có kinh nghiệm thực tế, "
        "hãy thêm vào phần Kỹ năng hoặc mô tả trong các dự án đã làm."
    ),
    ActionType.UNCERTAIN: (
        "AI không chắc chắn về yêu cầu này — hãy làm rõ thêm bằng cách thêm "
        "mô tả chi tiết, ví dụ cụ thể hoặc chứng chỉ liên quan vào CV."
    ),
    ActionType.PREFERRED_MISSING: (
        "Đây là yêu cầu ưu tiên (không bắt buộc) — bổ sung nếu có để tăng "
        "điểm cạnh tranh so với ứng viên khác."
    ),
}


def _resolve_action_type(status: str, mandatory: bool, criterion_id: str) -> ActionType:
    """Ánh xạ (status, mandatory, criterion_id) → ActionType."""
    if mandatory and status not in _SATISFIED_STATUSES:
        return ActionType.MANDATORY_MISSING
    if status in ("PARTIALLY_SUPPORTED",):
        return ActionType.EVIDENCE_WEAK
    if status in ("NOT_FOUND", "MISSING"):
        if criterion_id in ("preferred_skills",):
            return ActionType.PREFERRED_MISSING
        return ActionType.SKILL_MISSING
    return ActionType.UNCERTAIN


@dataclass
class GapItem:
    requirement_id: str
    requirement_text: str
    criterion_id: str
    criterion_label: str | None
    status: str
    mandatory: bool
    priority: str
    score_impact: float      # điểm có thể tăng nếu gap được lấp đầy
    evidence_count: int
    action_type: ActionType
    action_text: str
    weight: float


_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def compute_gap_priority(
    requirements: list[dict[str, Any]],
    criteria: list[dict[str, Any]],
) -> list[GapItem]:
    """
    Trả về danh sách GapItem đã được sắp xếp ưu tiên.

    Args:
        requirements: list of requirement dicts từ DB/pipeline.
            Các key cần có: requirement_id, text, mandatory, priority,
            status, criterion_id, criterion_score, payload_json.
        criteria: list of criterion dicts.
            Các key cần có: criterion_id, weight, raw_score.

    Returns:
        Danh sách GapItem, mandatory trước → score_impact giảm dần → id tăng dần.
    """
    if not requirements:
        return []

    # Build lookup: criterion_id → weight
    crit_weights: dict[str, float] = {c["criterion_id"]: float(c.get("weight", 0.0)) for c in criteria}

    # Build lookup: criterion_id → số requirements thuộc criterion này
    crit_req_count: dict[str, int] = {}
    for req in requirements:
        cid = req.get("criterion_id", "")
        crit_req_count[cid] = crit_req_count.get(cid, 0) + 1

    gaps: list[GapItem] = []

    for req in requirements:
        status = str(req.get("status") or "UNCERTAIN")

        # Bỏ qua các requirement đã được đáp ứng
        if status in _SATISFIED_STATUSES:
            continue

        req_id     = str(req.get("requirement_id", ""))
        text       = str(req.get("text") or req.get("requirement_text") or "")
        mandatory  = bool(req.get("mandatory", False))
        priority   = str(req.get("priority") or "medium")
        crit_id    = str(req.get("criterion_id") or "")
        weight     = crit_weights.get(crit_id, 0.0)

        # score_impact = weight / số req thuộc criterion đó
        req_count   = crit_req_count.get(crit_id, 1)
        score_impact = weight / req_count if req_count else 0.0

        # Số bằng chứng liên quan
        payload       = req.get("payload_json") or {}
        evidence_ids  = payload.get("evidence_ids") or []
        evidence_count = len(evidence_ids)

        action_type = _resolve_action_type(status, mandatory, crit_id)
        action_text = _ACTION_TEMPLATES[action_type]

        gaps.append(
            GapItem(
                requirement_id=req_id,
                requirement_text=text,
                criterion_id=crit_id,
                criterion_label=None,   # sẽ được join ở API layer
                status=status,
                mandatory=mandatory,
                priority=priority,
                score_impact=score_impact,
                evidence_count=evidence_count,
                action_type=action_type,
                action_text=action_text,
                weight=weight,
            )
        )

    # Sort: mandatory trước → score_impact giảm → priority → requirement_id tăng (stable)
    gaps.sort(
        key=lambda g: (
            0 if g.mandatory else 1,
            -g.score_impact,
            _PRIORITY_ORDER.get(g.priority, 99),
            g.requirement_id,
        )
    )

    return gaps
