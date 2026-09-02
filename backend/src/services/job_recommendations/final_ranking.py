"""Final ranking and Top-10 selection for Top Jobs recommendations.

Applies a deterministic role-and-readiness-first ranking strategy:
1. role-relevant jobs before role-mismatched jobs
2. application-ready jobs before mandatory gate failures
3. display_fit_score DESC (highest fit score first)
4. required_skills_coverage DESC (highest mandatory skills coverage first)
5. supported_requirements_count DESC (most verified requirements first)
6. rrf_rank ASC (better initial retrieval rank first)
7. jd_snapshot_id ASC (deterministic lexicographical tie-breaker)

After ranking, selects the top ``k`` jobs (default 10) and assigns sequential ranks (1..10).
Supports persisting recommendations to the database.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from inspect import isawaitable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.db.models import JDSnapshot, JobRecommendation, MatchRun


async def _scalar_ids(db: AsyncSession, statement: Any) -> set[str]:
    """Return scalar IDs for both SQLAlchemy results and async test doubles."""
    result = await db.scalars(statement)
    values = result.all()
    if isawaitable(values):
        values = await values
    # An unconfigured AsyncMock has no iterable result; treat it as no
    # persisted foreign keys rather than failing an otherwise valid run.
    try:
        return set(values)
    except TypeError:
        return set()

logger = logging.getLogger(__name__)


def get_fit_label(display_score: float, *, lang: str = "vi", application_ready: bool = False) -> str:
    """Return human-readable label for a fit score."""
    if display_score >= 85.0:
        return "Rất phù hợp" if lang == "vi" else "Excellent Fit"
    if display_score >= 70.0:
        return "Phù hợp" if lang == "vi" else "Good Fit"
    if display_score >= 50.0 or application_ready:
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
    role_relevant: bool = False
    role_track: str = "mismatch"
    role_reason: str = ""
    application_ready: bool = False
    role_affinity_score: float = 0.0
    ready_candidate_boost: float = 0.0
    mandatory_requirements_matched: int = 0
    total_mandatory_requirements: int = 0
    location: str | None = None
    work_mode: str | None = None
    source_url: str | None = None
    source_name: str | None = None
    seniority: str | None = None
    employment_type: str | None = None
    salary: str | None = None
    openings: int | None = None
    deadline: str | None = None
    posted_at: str | None = None
    applicant_count: int | None = None
    company_logo: str | None = None
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    score_breakdown: list[dict[str, Any]] = field(default_factory=list)
    top_strengths: list[str] = field(default_factory=list)
    top_gaps: list[str] = field(default_factory=list)
    user_explanation: dict[str, Any] = field(default_factory=dict)
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
            "source_url": self.source_url,
            "source_name": self.source_name,
            "seniority": self.seniority,
            "employment_type": self.employment_type,
            "salary": self.salary,
            "openings": self.openings,
            "deadline": self.deadline,
            "posted_at": self.posted_at,
            "applicant_count": self.applicant_count,
            "company_logo": self.company_logo,
            "required_skills": self.required_skills,
            "preferred_skills": self.preferred_skills,
            "skills": self.skills,
            "raw_fit_score": self.raw_fit_score,
            "fit_label": self.fit_label,
            "evidence_confidence": self.evidence_confidence,
            "mandatory_requirement_failed": self.mandatory_requirement_failed,
            "role_relevant": self.role_relevant,
            "role_track": self.role_track,
            "role_reason": self.role_reason,
            "application_ready": self.application_ready,
            "retrieval_rank": self.rrf_rank,
            "role_affinity_score": self.role_affinity_score,
            "ready_candidate_boost": self.ready_candidate_boost,
            "score_breakdown": self.score_breakdown,
            "top_strengths": self.top_strengths,
            "top_gaps": self.top_gaps,
            "user_explanation": self.user_explanation,
            "match_id": self.match_id,
        }


def _extract_item_value(item: Any, *keys: str, default: Any = None) -> Any:
    for key in keys:
        if isinstance(item, Mapping) and key in item and item[key] is not None:
            return item[key]
        if hasattr(item, key) and getattr(item, key) is not None:
            return getattr(item, key)
    return default


def _extract_ranking_tuple(candidate: Any) -> tuple[bool, bool, int, float, float, int, int, str]:
    """Extract eligibility and deterministic fit-ranking fields."""
    mandatory_failed = bool(_extract_item_value(candidate, "mandatory_requirement_failed", default=False))
    role_relevant = bool(_extract_item_value(candidate, "role_relevant", default=True))
    role_track = str(_extract_item_value(candidate, "role_track", default="primary"))
    track_priority = {"primary": 0, "adjacent": 1, "mismatch": 2}.get(role_track, 2)
    display_score = float(_extract_item_value(candidate, "display_fit_score", "display_score", "final_score", default=0.0))
    req_coverage = float(_extract_item_value(candidate, "required_skills_coverage", "must_have_coverage", default=0.0))
    supported_count = int(_extract_item_value(candidate, "supported_requirements_count", "verified_count", default=0))
    rrf_rank = int(_extract_item_value(candidate, "rrf_rank", "retrieval_rank", "rank", default=9999))
    jd_snapshot_id = str(_extract_item_value(candidate, "jd_snapshot_id", "job_id", default=""))

    return role_relevant, mandatory_failed, track_priority, display_score, req_coverage, supported_count, rrf_rank, jd_snapshot_id


def rank_top_jobs(
    candidates: Sequence[Any],
    *,
    top_k: int = 10,
    lang: str = "vi",
) -> list[RankedTopJob]:
    """Sort evaluated candidate jobs by deterministic role-and-readiness-first rules.

    Sorting Rules:
    1. role-relevant jobs before role-mismatched jobs
    2. application-ready jobs before mandatory gate failures
    3. display_fit_score DESC
    4. required_skills_coverage DESC
    5. supported_requirements_count DESC
    6. rrf_rank ASC
    7. jd_snapshot_id ASC

    Returns at most ``top_k`` (default 10) items with sequential ranks (1..k).
    """
    if not candidates:
        return []

    # Sort using deterministic multi-level key
    # Python sorts ascending, so for DESC criteria we negate numeric values.
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            not _extract_ranking_tuple(item)[0],  # 1. role relevant first
            _extract_ranking_tuple(item)[1],      # 2. ready before mandatory failure
            _extract_ranking_tuple(item)[2],      # 3. primary before adjacent
            -_extract_ranking_tuple(item)[3],
            -_extract_ranking_tuple(item)[4],
            -_extract_ranking_tuple(item)[5],
            _extract_ranking_tuple(item)[6],
            _extract_ranking_tuple(item)[7],
        ),
    )

    ranked_jobs: list[RankedTopJob] = []
    for rank_idx, item in enumerate(sorted_candidates[:top_k], start=1):
        role_relevant, mandatory_failed, _, display_score, req_coverage, supported_count, rrf_rank, jd_id = _extract_ranking_tuple(item)
        role_track = str(_extract_item_value(item, "role_track", default="primary" if role_relevant else "mismatch"))
        role_reason = str(_extract_item_value(item, "role_reason", default=""))
        raw_score = float(_extract_item_value(item, "raw_fit_score", "raw_score", default=display_score))
        title = str(_extract_item_value(item, "title", default="Vị trí tuyển dụng"))
        company = _extract_item_value(item, "company", default=None)
        company_str = str(company) if company is not None else None
        application_ready = bool(_extract_item_value(item, "application_ready", default=not mandatory_failed))
        fit_label = get_fit_label(display_score, lang=lang, application_ready=application_ready)
        confidence_level = str(_extract_item_value(item, "evidence_confidence", "confidence_level", default="medium"))
        conf_score = float(_extract_item_value(item, "confidence_score", "confidence", default=0.7))
        role_affinity_score = float(_extract_item_value(item, "role_affinity_score", default=0.0))
        ready_candidate_boost = float(_extract_item_value(item, "ready_candidate_boost", default=0.0))
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
        source_url = _extract_item_value(item, "source_url", default=None)
        source_name = _extract_item_value(item, "source_name", "source", default=None)
        seniority = _extract_item_value(item, "seniority", "job_level", default=None)
        employment_type = _extract_item_value(item, "employment_type", default=None)
        salary = _extract_item_value(item, "salary", "salary_range", default=None)
        openings = _extract_item_value(item, "openings", "quantity", default=None)
        deadline = _extract_item_value(item, "deadline", "application_deadline", default=None)
        posted_at = _extract_item_value(item, "posted_at", "crawl_date", "created_at", default=None)
        applicant_count = _extract_item_value(item, "applicant_count", default=None)
        company_logo = _extract_item_value(item, "company_logo", "logo_url", default=None)

        req_skills = _extract_item_value(item, "required_skills", "must_have_skills", default=[])
        req_skills_list = list(req_skills) if isinstance(req_skills, Sequence) and not isinstance(req_skills, str) else []

        pref_skills = _extract_item_value(item, "preferred_skills", "nice_to_have_skills", default=[])
        pref_skills_list = list(pref_skills) if isinstance(pref_skills, Sequence) and not isinstance(pref_skills, str) else []

        skills_val = _extract_item_value(item, "skills", default=[])
        skills_list = list(skills_val) if isinstance(skills_val, Sequence) and not isinstance(skills_val, str) else []

        exp_json = _extract_item_value(item, "explanation_json", default={})
        user_explanation = _extract_item_value(item, "user_explanation", default={})
        user_explanation_dict = dict(user_explanation) if isinstance(user_explanation, Mapping) else {}
        user_explanation_dict["role_relevant"] = role_relevant
        user_explanation_dict["role_track"] = role_track
        user_explanation_dict["role_reason"] = role_reason
        user_explanation_dict["application_ready"] = application_ready
        if "mandatory_summary" in user_explanation_dict and isinstance(user_explanation_dict["mandatory_summary"], dict):
            user_explanation_dict["mandatory_summary"]["matched"] = mandatory_matched
            user_explanation_dict["mandatory_summary"]["total"] = mandatory_total
            user_explanation_dict["mandatory_summary"]["failed"] = mandatory_failed

        # Maintain coherent verdict based on readiness and score
        if user_explanation_dict:
            if application_ready and not mandatory_failed:
                user_explanation_dict["verdict"] = "Có các điểm phù hợp có thể kiểm chứng với yêu cầu của vị trí."
            elif display_score < 50:
                user_explanation_dict["verdict"] = (
                    "Chưa phù hợp để ứng tuyển ngay — đây là vị trí gần nhất trong danh mục hiện có."
                    if rank_idx == 1
                    else f"Chưa phù hợp để ứng tuyển ngay — vị trí này xếp hạng #{rank_idx} trong danh sách hiện có."
                )

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
                role_relevant=role_relevant,
                role_track=role_track,
                role_reason=role_reason,
                application_ready=application_ready,
                role_affinity_score=round(role_affinity_score, 2),
                ready_candidate_boost=round(ready_candidate_boost, 4),
                required_skills_coverage=round(req_coverage, 2),
                supported_requirements_count=supported_count,
                rrf_rank=rrf_rank,
                match_id=match_id,
                mandatory_requirements_matched=mandatory_matched,
                total_mandatory_requirements=mandatory_total,
                location=str(location) if location else None,
                work_mode=str(work_mode) if work_mode else None,
                source_url=str(source_url) if source_url else None,
                source_name=str(source_name) if source_name else None,
                seniority=str(seniority) if seniority else None,
                employment_type=str(employment_type) if employment_type else None,
                salary=str(salary) if salary else None,
                openings=int(openings) if openings and str(openings).isdigit() else None,
                deadline=str(deadline) if deadline else None,
                posted_at=str(posted_at) if posted_at else None,
                applicant_count=int(applicant_count) if applicant_count is not None and str(applicant_count).isdigit() else None,
                company_logo=str(company_logo) if company_logo else None,
                required_skills=req_skills_list,
                preferred_skills=pref_skills_list,
                skills=skills_list,
                score_breakdown=breakdown_list,
                top_strengths=top_s_list,
                top_gaps=top_g_list,
                user_explanation=user_explanation_dict,
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
        persisted_snapshot_ids = await _scalar_ids(
            db, select(JDSnapshot.id).where(JDSnapshot.id.in_(snapshot_ids))
        )
    match_ids = {job.match_id for job in top_jobs if job.match_id}
    persisted_match_ids: set[str] = set()
    if match_ids:
        persisted_match_ids = await _scalar_ids(
            db, select(MatchRun.id).where(MatchRun.id.in_(match_ids))
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
