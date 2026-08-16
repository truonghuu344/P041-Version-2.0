"""Final ranking and Top-10 selection for Top Jobs recommendations.

Applies a deterministic 5-level tie-breaking sorting strategy:
1. display_fit_score DESC (highest fit score first)
2. required_skills_coverage DESC (highest mandatory skills coverage first)
3. supported_requirements_count DESC (most verified requirements first)
4. rrf_rank ASC (better initial retrieval rank first)
5. jd_snapshot_id ASC (deterministic lexicographical tie-breaker)

After ranking, selects the top ``k`` jobs (default 10) and assigns sequential ranks (1..10).
Supports persisting recommendations to the database.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.db.models import JDSnapshot, JobRecommendation, MatchRun

logger = logging.getLogger(__name__)


def get_fit_label(display_score: float, *, lang: str = "vi") -> str:
    """Return human-readable label for a fit score."""
    if display_score >= 85.0:
        return "Rất phù hợp" if lang == "vi" else "Excellent Fit"
    if display_score >= 70.0:
        return "Phù hợp" if lang == "vi" else "Good Fit"
    if display_score >= 50.0:
        return "Tiềm năng" if lang == "vi" else "Potential Fit"
    return "Cần cải thiện" if lang == "vi" else "Needs Improvement"


@dataclass(frozen=True, slots=True)
class RankedTopJob:
    """A fully evaluated, ranked Top Job recommendation ready for API / DB persistence."""

    rank: int
    job_id: str
    jd_snapshot_id: str
    title: str
    company: str | None
    display_fit_score: float
    raw_fit_score: float
    fit_label: str
    evidence_confidence: str
    confidence_score: float
    mandatory_requirement_failed: bool
    required_skills_coverage: float
    supported_requirements_count: int
    rrf_rank: int
    match_id: str
    mandatory_requirements_matched: int = 0
    total_mandatory_requirements: int = 0
    location: str | None = None
    work_mode: str | None = None
    score_breakdown: list[dict[str, Any]] = field(default_factory=list)
    top_strengths: list[str] = field(default_factory=list)
    top_gaps: list[str] = field(default_factory=list)
    mandatory_gate_json: dict[str, Any] = field(default_factory=dict)
    explanation_json: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rank": self.rank,
            "job_id": self.job_id,
            "jd_snapshot_id": self.jd_snapshot_id,
            "title": self.title,
            "company": self.company,
            "display_fit_score": self.display_fit_score,
            "required_skills_coverage": self.required_skills_coverage,
            "mandatory_requirements_matched": self.mandatory_requirements_matched,
            "total_mandatory_requirements": self.total_mandatory_requirements,
            "location": self.location,
            "work_mode": self.work_mode,
            "raw_fit_score": self.raw_fit_score,
            "fit_label": self.fit_label,
            "evidence_confidence": self.evidence_confidence,
            "mandatory_requirement_failed": self.mandatory_requirement_failed,
            "score_breakdown": self.score_breakdown,
            "top_strengths": self.top_strengths,
            "top_gaps": self.top_gaps,
            "match_id": self.match_id,
        }


def _extract_item_value(item: Any, *keys: str, default: Any = None) -> Any:
    for key in keys:
        if isinstance(item, Mapping) and key in item and item[key] is not None:
            return item[key]
        if hasattr(item, key) and getattr(item, key) is not None:
            return getattr(item, key)
    return default


def _extract_ranking_tuple(candidate: Any) -> tuple[float, float, int, int, str]:
    """Extract (display_score, req_coverage, supported_count, rrf_rank, jd_snapshot_id)."""
    display_score = float(_extract_item_value(candidate, "display_fit_score", "display_score", "final_score", default=0.0))
    req_coverage = float(_extract_item_value(candidate, "required_skills_coverage", "must_have_coverage", default=0.0))
    supported_count = int(_extract_item_value(candidate, "supported_requirements_count", "verified_count", default=0))
    rrf_rank = int(_extract_item_value(candidate, "rrf_rank", "retrieval_rank", "rank", default=9999))
    jd_snapshot_id = str(_extract_item_value(candidate, "jd_snapshot_id", "job_id", default=""))

    return display_score, req_coverage, supported_count, rrf_rank, jd_snapshot_id


def rank_top_jobs(
    candidates: Sequence[Any],
    *,
    top_k: int = 10,
    lang: str = "vi",
) -> list[RankedTopJob]:
    """Sort evaluated candidate jobs by the deterministic 5-level ranking rules.

    Sorting Rules:
    1. display_fit_score DESC
    2. required_skills_coverage DESC
    3. supported_requirements_count DESC
    4. rrf_rank ASC
    5. jd_snapshot_id ASC

    Returns at most ``top_k`` (default 10) items with sequential ranks (1..k).
    """
    if not candidates:
        return []

    # Sort using deterministic multi-level key
    # Python sorts ascending, so for DESC criteria we negate numeric values.
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            -_extract_ranking_tuple(item)[0],  # 1. display_fit_score DESC
            -_extract_ranking_tuple(item)[1],  # 2. required_skills_coverage DESC
            -_extract_ranking_tuple(item)[2],  # 3. supported_requirements_count DESC
            _extract_ranking_tuple(item)[3],   # 4. rrf_rank ASC
            _extract_ranking_tuple(item)[4],   # 5. jd_snapshot_id ASC
        ),
    )

    ranked_jobs: list[RankedTopJob] = []
    for rank_idx, item in enumerate(sorted_candidates[:top_k], start=1):
        display_score, req_coverage, supported_count, rrf_rank, jd_id = _extract_ranking_tuple(item)
        raw_score = float(_extract_item_value(item, "raw_fit_score", "raw_score", default=display_score))
        title = str(_extract_item_value(item, "title", default="Vị trí tuyển dụng"))
        company = _extract_item_value(item, "company", default=None)
        company_str = str(company) if company is not None else None
        fit_label = str(_extract_item_value(item, "fit_label", default=get_fit_label(display_score, lang=lang)))
        confidence_level = str(_extract_item_value(item, "evidence_confidence", "confidence_level", default="medium"))
        conf_score = float(_extract_item_value(item, "confidence_score", "confidence", default=0.7))
        mandatory_failed = bool(_extract_item_value(item, "mandatory_requirement_failed", default=False))
        match_id = str(_extract_item_value(item, "match_id", default=f"MATCH_{jd_id}"))

        breakdown = _extract_item_value(item, "score_breakdown", default=[])
        breakdown_list = [b if isinstance(b, dict) else dict(b) for b in breakdown] if isinstance(breakdown, Sequence) else []

        top_s = _extract_item_value(item, "top_strengths", default=[])
        top_s_list = list(top_s) if isinstance(top_s, Sequence) and not isinstance(top_s, str) else []

        top_g = _extract_item_value(item, "top_gaps", default=[])
        top_g_list = list(top_g) if isinstance(top_g, Sequence) and not isinstance(top_g, str) else []

        gate_json = _extract_item_value(item, "mandatory_gate_json", "gate_json", default={})
        mandatory_matched = int(_extract_item_value(item, "mandatory_requirements_matched", default=0))
        mandatory_total = int(_extract_item_value(item, "total_mandatory_requirements", default=0))
        location = _extract_item_value(item, "location", default=None)
        work_mode = _extract_item_value(item, "work_mode", "remote_type", default=None)
        exp_json = _extract_item_value(item, "explanation_json", default={})

        ranked_jobs.append(
            RankedTopJob(
                rank=rank_idx,
                job_id=str(_extract_item_value(item, "job_id", default=jd_id)),
                jd_snapshot_id=jd_id,
                title=title,
                company=company_str,
                display_fit_score=round(display_score, 1),
                raw_fit_score=round(raw_score, 1),
                fit_label=fit_label,
                evidence_confidence=confidence_level,
                confidence_score=round(conf_score, 2),
                mandatory_requirement_failed=mandatory_failed,
                required_skills_coverage=round(req_coverage, 2),
                supported_requirements_count=supported_count,
                rrf_rank=rrf_rank,
                match_id=match_id,
                mandatory_requirements_matched=mandatory_matched,
                total_mandatory_requirements=mandatory_total,
                location=str(location) if location else None,
                work_mode=str(work_mode) if work_mode else None,
                score_breakdown=breakdown_list,
                top_strengths=top_s_list,
                top_gaps=top_g_list,
                mandatory_gate_json=dict(gate_json) if isinstance(gate_json, Mapping) else {},
                explanation_json=dict(exp_json) if isinstance(exp_json, Mapping) else {},
            )
        )

    return ranked_jobs


async def persist_top_recommendations(
    db: AsyncSession,
    run_id: str,
    top_jobs: Sequence[RankedTopJob],
) -> list[JobRecommendation]:
    """Persist ranked jobs without treating market-catalog IDs as snapshot IDs."""
    snapshot_ids = {job.jd_snapshot_id for job in top_jobs if job.jd_snapshot_id}
    persisted_snapshot_ids: set[str] = set()
    if snapshot_ids:
        persisted_snapshot_ids = set(
            (await db.scalars(select(JDSnapshot.id).where(JDSnapshot.id.in_(snapshot_ids)))).all()
        )
    match_ids = {job.match_id for job in top_jobs if job.match_id}
    persisted_match_ids: set[str] = set()
    if match_ids:
        persisted_match_ids = set(
            (await db.scalars(select(MatchRun.id).where(MatchRun.id.in_(match_ids)))).all()
        )

    records: list[JobRecommendation] = []
    for job in top_jobs:
        # Catalog entries such as "JD-057" are legitimate job IDs, but not
        # rows in jd_snapshots and therefore must not be stored in this FK.
        jd_snapshot_id = job.jd_snapshot_id if job.jd_snapshot_id in persisted_snapshot_ids else None
        match_id = job.match_id if job.match_id in persisted_match_ids else None
        rec = JobRecommendation(
            run_id=run_id,
            job_id=job.job_id,
            jd_snapshot_id=jd_snapshot_id,
            rank=job.rank,
            raw_fit_score=job.raw_fit_score,
            display_fit_score=job.display_fit_score,
            confidence=job.confidence_score,
            mandatory_requirement_failed=job.mandatory_requirement_failed,
            mandatory_gate_json=job.mandatory_gate_json or None,
            match_id=match_id,
            explanation_json=job.explanation_json or None,
        )
        db.add(rec)
        records.append(rec)

    await db.flush()
    logger.info("Persisted %d top job recommendations for run_id=%s", len(records), run_id)
    return records
