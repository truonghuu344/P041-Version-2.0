"""
Match Evaluation V2 API — Thành viên 4 (feat/match-evaluation-modal)

5 endpoints:
  GET /api/v2/matches/{match_id}/evaluation
  GET /api/v2/matches/{match_id}/evaluation/gaps
  GET /api/v2/matches/{match_id}/evaluation/criteria
  GET /api/v2/matches/{match_id}/evaluation/criteria/{criterion_id}/requirements
  GET /api/v2/matches/{match_id}/evaluation/requirements/{requirement_id}/evidence

Nguyên tắc:
- Không tự tính score — chỉ đọc từ DB
- Ownership check: 404 (không phải 403) để tránh enumeration attack
- Phân trang cho requirements
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.errors import PipelineError
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import (
    CriterionEvaluationArtifact,
    JDRequirementArtifact,
    MatchEvidenceArtifact,
    MatchRun,
    User,
)
from src.models.v2_schemas import (
    CriteriaListData,
    CriterionSummary,
    EvidenceDetail,
    EvidenceListData,
    GapAction,
    GapListData,
    MatchEvaluationData,
    MandatoryGate,
    RequirementDetail,
    RequirementListData,
)
from src.services.gap_priority_service import compute_gap_priority

router = APIRouter(prefix="/v2/matches", tags=["Match Evaluation V2"])

# ── Label mapping cho 5 tiêu chí chuẩn ───────────────────────────────────────

_CRITERION_LABELS: dict[str, str] = {
    "required_skills":         "Kỹ năng bắt buộc",
    "relevant_experience":     "Kinh nghiệm liên quan",
    "education":               "Học vấn",
    "preferred_skills":        "Kỹ năng ưu tiên",
    "domain_responsibilities": "Domain & Trách nhiệm",
}

_CONFIDENCE_THRESHOLDS = {"high": 0.80, "medium": 0.55, "low": 0.35}


def _confidence(score: float | None) -> str:
    if score is None:
        return "very_low"
    pct = score / 100.0
    if pct >= _CONFIDENCE_THRESHOLDS["high"]:
        return "high"
    if pct >= _CONFIDENCE_THRESHOLDS["medium"]:
        return "medium"
    if pct >= _CONFIDENCE_THRESHOLDS["low"]:
        return "low"
    return "very_low"


async def _get_match_or_404(match_id: str, user_id: str, db: AsyncSession) -> MatchRun:
    """Lấy MatchRun, kiểm tra ownership. Trả về 404 để tránh enumeration."""
    match = await db.get(MatchRun, match_id)
    if match is None or match.user_id != user_id:
        raise PipelineError(404, "Match không tồn tại hoặc bạn không có quyền truy cập.")
    return match


# ── 1. Evaluation summary ─────────────────────────────────────────────────────

@router.get("/{match_id}/evaluation", response_model=MatchEvaluationData)
async def get_match_evaluation(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MatchEvaluationData:
    """Trả về điểm số tổng hợp, confidence, mandatory gate và tóm tắt 5 tiêu chí."""
    match = await _get_match_or_404(match_id, current_user.id, db)

    if match.status != "COMPLETED":
        return MatchEvaluationData(
            match_id=match_id,
            status=match.status,
            fit_score=None,
            confidence=None,
            mandatory_gate=MandatoryGate(failed=False),
            criteria_summary=[],
            trace_id=match.trace_id,
            created_at=match.created_at.isoformat() if match.created_at else None,
        )

    # Lấy criteria evaluations
    criteria_rows = (
        await db.execute(
            select(CriterionEvaluationArtifact).where(
                CriterionEvaluationArtifact.match_id == match_id
            )
        )
    ).scalars().all()

    # Lấy requirements để tính requirements_met/partial
    req_rows = (
        await db.execute(
            select(JDRequirementArtifact).where(
                JDRequirementArtifact.match_id == match_id
            )
        )
    ).scalars().all()

    # Group requirements theo criterion_id
    reqs_by_crit: dict[str, list[JDRequirementArtifact]] = {}
    for req in req_rows:
        payload = req.payload_json or {}
        cid = payload.get("criterion_id") or req.requirement_type or "unknown"
        reqs_by_crit.setdefault(cid, []).append(req)

    # Build criteria summary
    mandatory_failed: list[str] = []
    criteria_summary: list[CriterionSummary] = []

    for crit in criteria_rows:
        cid = crit.criterion_id
        crit_reqs = reqs_by_crit.get(cid, [])
        met     = sum(1 for r in crit_reqs if r.status == "SUPPORTED")
        partial = sum(1 for r in crit_reqs if r.status == "PARTIALLY_SUPPORTED")

        # Top gap: requirement bắt buộc bị trượt đầu tiên
        top_gap_text: str | None = None
        for r in crit_reqs:
            if r.mandatory and r.status not in ("SUPPORTED",):
                top_gap_text = r.text[:120] if r.text else None
                mandatory_failed.append(r.requirement_id)
                break

        criteria_summary.append(
            CriterionSummary(
                criterion_id=cid,
                label=_CRITERION_LABELS.get(cid, cid),
                weight=crit.weight,
                raw_score=crit.raw_score,
                weighted_score=crit.weighted_score,
                status=crit.status,
                requirements_total=len(crit_reqs),
                requirements_met=met,
                requirements_partial=partial,
                top_gap_text=top_gap_text,
                reason=crit.reason,
            )
        )

    fit_score = match.final_score
    return MatchEvaluationData(
        match_id=match_id,
        status=match.status,
        fit_score=fit_score,
        confidence=_confidence(fit_score),
        mandatory_gate=MandatoryGate(
            failed=len(mandatory_failed) > 0,
            failed_requirements=mandatory_failed,
        ),
        criteria_summary=criteria_summary,
        versions=match.versions_json or {},
        trace_id=match.trace_id,
        created_at=match.created_at.isoformat() if match.created_at else None,
    )


# ── 2. Gap list (đã được sắp xếp ưu tiên) ────────────────────────────────────

@router.get("/{match_id}/evaluation/gaps", response_model=GapListData)
async def get_match_gaps(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GapListData:
    """Trả về danh sách gap đã sắp xếp ưu tiên từ gap_priority_service."""
    match = await _get_match_or_404(match_id, current_user.id, db)

    req_rows = (
        await db.execute(
            select(JDRequirementArtifact).where(JDRequirementArtifact.match_id == match_id)
        )
    ).scalars().all()

    crit_rows = (
        await db.execute(
            select(CriterionEvaluationArtifact).where(
                CriterionEvaluationArtifact.match_id == match_id
            )
        )
    ).scalars().all()

    # Chuẩn bị input cho gap_priority_service
    reqs_for_service = [
        {
            "requirement_id": r.requirement_id,
            "text": r.text,
            "mandatory": r.mandatory,
            "priority": r.priority,
            "status": r.status or "UNCERTAIN",
            "criterion_id": (r.payload_json or {}).get("criterion_id") or r.requirement_type,
            "criterion_score": r.criterion_score,
            "payload_json": r.payload_json or {},
        }
        for r in req_rows
    ]

    crits_for_service = [
        {"criterion_id": c.criterion_id, "weight": c.weight, "raw_score": c.raw_score}
        for c in crit_rows
    ]

    gap_items = compute_gap_priority(reqs_for_service, crits_for_service)

    # Enrich với criterion label
    for gap in gap_items:
        gap.criterion_label = _CRITERION_LABELS.get(gap.criterion_id, gap.criterion_id)

    mandatory_failed = sum(1 for g in gap_items if g.mandatory)

    return GapListData(
        match_id=match_id,
        gaps=[
            GapAction(
                requirement_id=g.requirement_id,
                requirement_text=g.requirement_text,
                criterion_id=g.criterion_id,
                criterion_label=g.criterion_label,
                status=g.status,
                mandatory=g.mandatory,
                priority=g.priority,
                score_impact=g.score_impact,
                evidence_count=g.evidence_count,
                action_type=g.action_type.value,
                action_text=g.action_text,
                weight=g.weight,
            )
            for g in gap_items
        ],
        total=len(gap_items),
        mandatory_failed_count=mandatory_failed,
    )


# ── 3. Criteria list ──────────────────────────────────────────────────────────

@router.get("/{match_id}/evaluation/criteria", response_model=CriteriaListData)
async def get_match_criteria(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CriteriaListData:
    """Trả về danh sách tất cả criteria (dùng để load requirements lazy)."""
    match = await _get_match_or_404(match_id, current_user.id, db)

    crit_rows = (
        await db.execute(
            select(CriterionEvaluationArtifact).where(
                CriterionEvaluationArtifact.match_id == match_id
            )
        )
    ).scalars().all()

    return CriteriaListData(
        match_id=match_id,
        criteria=[
            CriterionSummary(
                criterion_id=c.criterion_id,
                label=_CRITERION_LABELS.get(c.criterion_id, c.criterion_id),
                weight=c.weight,
                raw_score=c.raw_score,
                weighted_score=c.weighted_score,
                status=c.status,
                requirements_total=0,
                requirements_met=0,
                requirements_partial=0,
                reason=c.reason,
            )
            for c in crit_rows
        ],
    )


# ── 4. Requirements per criterion (có phân trang) ────────────────────────────

@router.get(
    "/{match_id}/evaluation/criteria/{criterion_id}/requirements",
    response_model=RequirementListData,
)
async def get_criterion_requirements(
    match_id: str,
    criterion_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RequirementListData:
    """Trả về danh sách requirements cho 1 criterion, có phân trang."""
    await _get_match_or_404(match_id, current_user.id, db)

    all_reqs = (
        await db.execute(
            select(JDRequirementArtifact).where(
                JDRequirementArtifact.match_id == match_id
            )
        )
    ).scalars().all()

    # Lọc theo criterion_id (lưu trong payload_json hoặc requirement_type)
    filtered = [
        r for r in all_reqs
        if (r.payload_json or {}).get("criterion_id") == criterion_id
        or r.requirement_type == criterion_id
    ]

    total = len(filtered)
    start = (page - 1) * page_size
    paged = filtered[start : start + page_size]

    return RequirementListData(
        criterion_id=criterion_id,
        items=[
            RequirementDetail(
                requirement_id=r.requirement_id,
                criterion_id=criterion_id,
                text=r.text,
                mandatory=r.mandatory,
                priority=r.priority,
                status=r.status or "UNCERTAIN",
                criterion_score=r.criterion_score,
                evidence_ids=(r.payload_json or {}).get("evidence_ids", []),
            )
            for r in paged
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── 5. Evidence per requirement ───────────────────────────────────────────────

@router.get(
    "/{match_id}/evaluation/requirements/{requirement_id}/evidence",
    response_model=EvidenceListData,
)
async def get_requirement_evidence(
    match_id: str,
    requirement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EvidenceListData:
    """Trả về tất cả evidence cho 1 requirement, sắp xếp theo fusion_score giảm dần."""
    await _get_match_or_404(match_id, current_user.id, db)

    ev_rows = (
        await db.execute(
            select(MatchEvidenceArtifact).where(
                MatchEvidenceArtifact.match_id == match_id,
                MatchEvidenceArtifact.requirement_id == requirement_id,
            )
        )
    ).scalars().all()

    ev_rows_sorted = sorted(ev_rows, key=lambda e: e.fusion_score or 0.0, reverse=True)

    return EvidenceListData(
        requirement_id=requirement_id,
        items=[
            EvidenceDetail(
                evidence_id=e.evidence_id,
                requirement_id=e.requirement_id,
                chunk_id=e.chunk_id,
                text=e.text,
                source_page=e.source_page,
                source_section=e.source_section,
                span_start=e.span_start,
                span_end=e.span_end,
                fusion_score=e.fusion_score,
                semantic_score=e.semantic_score,
                bm25_score=e.bm25_score,
            )
            for e in ev_rows_sorted
        ],
        total=len(ev_rows_sorted),
    )
