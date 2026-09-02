"""Top Jobs recommendation orchestration service.

Executes the complete, reproducible Top Jobs recommendation pipeline:
1. Load and authorize the candidate-owned CV snapshot.
2. Create an initial JobRecommendationRun tracking record.
3. Apply deterministic metadata hard/soft filters over the job catalog.
4. Retrieve candidate jobs:
   - If filtered jobs <= candidate_k (default 30): use all filtered jobs.
   - Else: run BM25 and Semantic retrievers, then merge via Weighted RRF (top candidate_k).
5. For each candidate:
   - Reuse a completed Match when present; otherwise run the deterministic
     CV–JD evidence evaluation used for the Top-10 preview.
   - Calculate rubric Fit Score with dynamic active-weight normalization.
   - Apply the Mandatory Requirement Gate (capping display score at 49 when coverage < 50%).
   - Calculate Evidence Confidence (high / medium / low).
   - Generate deterministic, auditable Strengths and Gaps explanations.
6. Apply deterministic 5-level tie-breaking final ranking.
7. Select Top-10 (or top_k), persist to database, mark run COMPLETED, and return results.
"""

from __future__ import annotations

import logging
import re
import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.config import Settings, get_settings

# pyrefly: ignore [missing-import]
from src.db.models import CVSnapshot, JobRecommendationRun

# pyrefly: ignore [missing-import]
from src.schemas.job_recommendation import (
    JobRecommendationRequest,
)

# pyrefly: ignore [missing-import]
from src.services.cv_jd_matching import build_cv_jd_evidence

# pyrefly: ignore [missing-import]
from src.services.cv_retrieval import build_cv_retrieval_text

# pyrefly: ignore [missing-import]
from src.services.job_catalog import load_enterprise_job_catalog

# pyrefly: ignore [missing-import]
from src.services.job_recommendation_filters import apply_filters

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.bm25_retriever import BM25Retriever, RankedJob

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.confidence import calculate_evidence_confidence

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.explanation import generate_deterministic_explanations

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import (
    RankedTopJob,
    get_fit_label,
    persist_top_recommendations,
    rank_top_jobs,
)

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.fit_score import calculate_fit_score

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.mandatory_gate import apply_mandatory_gate

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.match_reuse import find_existing_match

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.rrf import weighted_rrf

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.semantic_retriever import SemanticRetriever

logger = logging.getLogger(__name__)

CURRENT_PIPELINE_VERSION = "2.1"
CURRENT_NORMALIZATION_VERSION = "1.0"
CURRENT_RUBRIC_VERSION = "1.0"
METADATA_PREFERENCE_WEIGHT = 0.15
DEFAULT_READY_CANDIDATE_RESERVE = 10
DEFAULT_READY_CANDIDATE_BOOST_MAX = 0.15


def _extract_job_id(job: Mapping[str, Any] | Any) -> str:
    if isinstance(job, Mapping):
        return str(job.get("jd_snapshot_id") or job.get("source_id") or job.get("id") or "")
    return str(getattr(job, "jd_snapshot_id", None) or getattr(job, "source_id", None) or getattr(job, "id", ""))


def _extract_job_requirements(job: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Extract or synthesize structured requirements for match evaluation."""
    if "requirements" in job and isinstance(job["requirements"], list) and job["requirements"]:
        return list(job["requirements"])

    requirements: list[dict[str, Any]] = []
    # 1. Skills -> JD_REQUIRED_SKILL
    skills = job.get("skills") or []
    for idx, skill in enumerate(skills, start=1):
        if skill:
            requirements.append(
                {
                    "requirement_id": f"REQ_SKILL_{idx:03d}",
                    "requirement_type": "JD_REQUIRED_SKILL",
                    "text": str(skill),
                    "normalized_value": str(skill),
                    "mandatory": True,
                    "confidence": 1.0,
                }
            )

    # 2. Description / Domain -> JD_RESPONSIBILITY
    desc = str(job.get("description") or "").strip()
    if desc:
        requirements.append(
            {
                "requirement_id": "REQ_DESC_001",
                "requirement_type": "JD_RESPONSIBILITY",
                "text": desc[:1000],
                "mandatory": False,
                "confidence": 0.9,
            }
        )

    return requirements


def _rerank_by_metadata_preference(
    candidates: Sequence[RankedJob],
    job_catalog_map: Mapping[str, Mapping[str, Any]],
    *,
    preference_weight: float = METADATA_PREFERENCE_WEIGHT,
) -> list[RankedJob]:
    """Apply role/seniority/industry preference without turning it into fit.

    The preference is calculated from optional user filters before retrieval. It
    must influence which candidates receive evidence evaluation, but never the
    CV-JD fit score.  Keep the retrieval signal dominant and retain a stable
    ID tie-breaker so the same inputs always yield the same candidate set.
    """
    if not candidates:
        return []

    weight = min(1.0, max(0.0, float(preference_weight)))
    max_retrieval_score = max(candidate.score for candidate in candidates)
    if max_retrieval_score <= 0:
        max_retrieval_score = 1.0

    scored: list[tuple[str, float]] = []
    for candidate in candidates:
        job = job_catalog_map.get(candidate.jd_snapshot_id, {})
        preference = min(100.0, max(0.0, float(job.get("metadata_preference_score") or 0.0)))
        retrieval_score = candidate.score / max_retrieval_score
        combined_score = (1.0 - weight) * retrieval_score + weight * (preference / 100.0)
        scored.append((candidate.jd_snapshot_id, combined_score))

    scored.sort(key=lambda item: (-item[1], item[0]))
    return [
        RankedJob(jd_snapshot_id=jd_id, rank=index, score=round(score, 8))
        for index, (jd_id, score) in enumerate(scored, start=1)
    ]


def _ready_candidate_boost(job: Mapping[str, Any], cv_retrieval_text: str) -> float:
    """Return a bounded retrieval-only boost for entry-level role matches."""
    if not bool(job.get("role_relevant", True)):
        return 0.0

    level = str(job.get("job_level") or "").casefold()
    entry_level_bonus = 0.08 if any(value in level for value in ("intern", "junior", "fresher")) else 0.0
    cv_tokens = set(re.findall(r"[a-z0-9+#.]{2,}", cv_retrieval_text.casefold()))
    job_text = " ".join(
        [str(job.get("title") or ""), *map(str, job.get("skills") or [])]
    ).casefold()
    job_tokens = set(re.findall(r"[a-z0-9+#.]{2,}", job_text))
    skill_overlap_bonus = min(0.07, 0.02 * len(cv_tokens & job_tokens))
    return round(min(DEFAULT_READY_CANDIDATE_BOOST_MAX, entry_level_bonus + skill_overlap_bonus), 4)


def _reserve_ready_role_candidates(
    candidates: Sequence[RankedJob],
    job_catalog_map: Mapping[str, Mapping[str, Any]],
    *,
    candidate_k: int,
    reserve: int = DEFAULT_READY_CANDIDATE_RESERVE,
) -> list[RankedJob]:
    """Reserve a small, deterministic part of the evaluation pool for ready-role signals."""
    if candidate_k < 1:
        return []
    reserve_count = max(0, min(int(reserve), candidate_k))
    boosted_ids = sorted(
        (
            (job_id, float(job.get("ready_candidate_boost") or 0.0))
            for job_id, job in job_catalog_map.items()
            if bool(job.get("role_relevant", True)) and float(job.get("ready_candidate_boost") or 0.0) > 0.0
        ),
        key=lambda item: (-item[1], item[0]),
    )[:reserve_count]
    reserved_ids = [job_id for job_id, _ in boosted_ids]
    selected_ids = reserved_ids + [
        candidate.jd_snapshot_id for candidate in candidates if candidate.jd_snapshot_id not in reserved_ids
    ]
    selected_ids = list(dict.fromkeys(selected_ids))[:candidate_k]
    by_id = {candidate.jd_snapshot_id: candidate for candidate in candidates}
    return [
        RankedJob(
            jd_snapshot_id=job_id,
            rank=index,
            score=by_id.get(job_id, RankedJob(job_id, 9999, 0.0)).score,
        )
        for index, job_id in enumerate(selected_ids, start=1)
    ]


_CRITERION_LABELS_VI = {
    "CRIT_REQUIRED_SKILL": "Kỹ năng bắt buộc",
    "CRIT_EXPERIENCE": "Kinh nghiệm liên quan",
    "CRIT_EDUCATION": "Học vấn",
    "CRIT_PREFERRED_SKILL": "Kỹ năng ưu tiên",
    "CRIT_DOMAIN": "Lĩnh vực / trách nhiệm",
}


# Extracted JD requirements occasionally contain language/country fragments
# (for example ``en``) or whole prose sentences. They remain part of the
# scoring audit, but are not useful candidate-facing gaps or actions.
_DISPLAYABLE_SHORT_REQUIREMENTS = frozenset({"ai", "go", "c", "c#", "c++", "r"})
_DISPLAY_IGNORED_REQUIREMENTS = frozenset({"en", "vi", "vn", "us", "uk", "na", "n/a", "other", "khác"})
_MAX_DISPLAY_REQUIREMENT_WORDS = 10
_MAX_DISPLAY_REQUIREMENT_LENGTH = 80

_CURRENCY_AND_SALARY_PATTERNS = re.compile(
    r"(\b(\d{1,3}([,.]\d{3})+|vnd|usd|gross|net|salary|lương|stipend|thu nhập|thù lao|tháng|/month|/tháng|triệu|\$|after the internship)\b)",
    re.IGNORECASE,
)
_QUIZ_AND_NOISE_PATTERNS = re.compile(
    r"\b(correct answer|correct answers|different situations|option [a-d]|choice [a-d]|true/false|đáp án|câu trả lời|câu hỏi)\b",
    re.IGNORECASE,
)
_BENEFIT_AND_META_PATTERNS = re.compile(
    r"\b(bảo hiểm|bhxh|phúc lợi|teambuilding|du lịch|thời gian làm việc|working hours|chế độ nghỉ|khám sức khỏe|trợ cấp|allowance|bonus|thưởng tết|thưởng lễ|about us|về chúng tôi|liên hệ|gửi cv|apply to|hạn nộp|deadline|địa chỉ|contact us)\b",
    re.IGNORECASE,
)


def _is_displayable_requirement(requirement: str) -> bool:
    """Whether a requirement is concise and clean enough for the candidate UI.

    This filters out noisy salary fragments, question-answer choices, perks,
    and unformatted strings. This has no effect on underlying matching scores.
    """
    clean = re.sub(r"\s+", " ", str(requirement or "")).strip()
    folded = clean.casefold()
    if not clean or folded in _DISPLAY_IGNORED_REQUIREMENTS:
        return False
    if not re.search(r"[A-Za-zÀ-ỹ]", clean):
        return False
    if clean.startswith((",", ".", ":", ";", "-", "_", "~", "/")):
        return False
    if _CURRENCY_AND_SALARY_PATTERNS.search(clean):
        return False
    if _QUIZ_AND_NOISE_PATTERNS.search(clean):
        return False
    if _BENEFIT_AND_META_PATTERNS.search(clean):
        return False
    if len(clean) <= 2:
        return folded in _DISPLAYABLE_SHORT_REQUIREMENTS
    words = re.findall(r"[A-Za-zÀ-ỹ0-9+#.]+", clean)
    if len(clean) > _MAX_DISPLAY_REQUIREMENT_LENGTH or len(words) > _MAX_DISPLAY_REQUIREMENT_WORDS:
        return False
    return not re.match(r"^(qualifications?|responsibilities|requirements?)\b", folded)


def _calculate_mandatory_counts(requirements: Mapping[str, Any]) -> tuple[int, int]:
    """Calculate canonical (matched_mandatory, total_mandatory) count.

    Only actual mandatory requirements (bool(item.get("mandatory")) is True)
    are counted. Skill requirements or general requirements that are not
    marked mandatory are excluded.
    """
    matched_reqs = requirements.get("matched") or []
    partial_reqs = requirements.get("partial") or []
    missing_reqs = requirements.get("missing") or []
    uncertain_reqs = requirements.get("uncertain") or []

    all_reqs = [*matched_reqs, *partial_reqs, *missing_reqs, *uncertain_reqs]

    mandatory_total = sum(
        1 for item in all_reqs
        if isinstance(item, Mapping) and bool(item.get("mandatory"))
    )
    mandatory_matched = sum(
        1 for item in matched_reqs
        if isinstance(item, Mapping) and bool(item.get("mandatory"))
    )
    return mandatory_matched, mandatory_total


def extract_candidate_target_role(
    cv_snapshot: Any,
    user: Any | None = None,
) -> str | None:
    """Extract candidate's target role from CV snapshot or profile without inventing one."""
    profile: Mapping[str, Any] = {}
    if isinstance(cv_snapshot, Mapping):
        nested = cv_snapshot.get("profile_json")
        profile = nested if isinstance(nested, Mapping) else cv_snapshot
    elif hasattr(cv_snapshot, "profile_json") and isinstance(cv_snapshot.profile_json, Mapping):
        profile = cv_snapshot.profile_json

    # 1. Primary direct keys
    for key in ("target_role", "desired_role", "targetRole", "role", "headline", "title"):
        val = profile.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()

    # 2. List of target roles
    target_roles = profile.get("target_roles")
    if isinstance(target_roles, list) and target_roles:
        first_role = target_roles[0]
        if isinstance(first_role, str) and first_role.strip():
            return first_role.strip()
    elif isinstance(target_roles, str) and target_roles.strip():
        return target_roles.strip()

    # 3. Nested career goals / personal info
    for nested_key in ("careerGoals", "career_goals", "careerGoal", "career_goal"):
        nested = profile.get(nested_key)
        if isinstance(nested, Mapping):
            for sub_key in ("targetRole", "target_role", "role", "title"):
                val = nested.get(sub_key)
                if isinstance(val, str) and val.strip():
                    return val.strip()

    # 4. User model fallback if provided
    if user is not None and getattr(user, "target_role", None):
        u_role = str(user.target_role).strip()
        if u_role:
            return u_role

    return None


def _build_user_explanation(
    evidence: Mapping[str, Any],
    *,
    display_score: float,
    confidence_level: str,
    mandatory_failed: bool,
) -> dict[str, Any]:
    """Create an evidence-first explanation safe for the Top Jobs UI.

    This is intentionally deterministic: every claim identifies the JD
    requirement and, for supported items, only quotes text returned by the
    matching pipeline from the candidate CV.
    """
    requirements = evidence.get("requirements") or {}
    details: list[dict[str, Any]] = []
    group_status = {
        "matched": "SUPPORTED",
        "partial": "PARTIALLY_SUPPORTED",
        "missing": "NOT_FOUND",
        "uncertain": "UNCERTAIN",
    }
    for group, status in group_status.items():
        for item in requirements.get(group) or []:
            if not isinstance(item, Mapping):
                continue
            raw_evidence = item.get("evidence") or []
            quotes = [
                str(source.get("text") or source.get("quote") or "").strip()
                for source in raw_evidence
                if isinstance(source, Mapping)
            ]
            requirement_text = str(item.get("normalized_value") or item.get("text") or "").strip()
            if not requirement_text:
                continue
            details.append({
                "requirement_id": str(item.get("requirement_id") or item.get("id") or ""),
                "requirement": requirement_text,
                "status": str(item.get("status") or status),
                "mandatory": bool(item.get("mandatory")),
                "priority": str(item.get("priority") or "medium"),
                "reason": str(item.get("reason") or "Chưa có đủ thông tin để kết luận."),
                "cv_evidence_quotes": list(dict.fromkeys(quote for quote in quotes if quote))[:2],
            })

    details.sort(key=lambda item: (
        item["status"] == "SUPPORTED",
        not item["mandatory"],
        item["requirement"].casefold(),
    ))
    supported = [item for item in details if item["status"] == "SUPPORTED"]
    gaps = [item for item in details if item["status"] != "SUPPORTED"]
    matched_mandatory, total_mandatory = _calculate_mandatory_counts(requirements)

    if mandatory_failed:
        if display_score < 50:
            verdict = "Chưa phù hợp để ứng tuyển ngay — đây là vị trí gần nhất trong danh mục hiện có."
        else:
            verdict = "Có nền tảng liên quan, nhưng chưa đáp ứng ngưỡng yêu cầu bắt buộc của vị trí."
    else:
        verdict = "Có các điểm phù hợp có thể kiểm chứng với yêu cầu của vị trí."
    confidence_message = {
        "high": "Độ tin cậy cao: phần lớn yêu cầu có thông tin CV xác minh được.",
        "medium": "Độ tin cậy trung bình: một phần yêu cầu chưa có thông tin đủ rõ.",
        "low": "Độ tin cậy thấp: CV chưa có đủ thông tin để xác nhận nhiều yêu cầu.",
    }.get(confidence_level, "Độ tin cậy chưa xác định.")

    # Keep all gaps in the score/evidence audit, but display only requirements
    # that can be acted upon by a candidate and are clean/non-sensitive.
    display_supported = [item for item in supported if _is_displayable_requirement(item["requirement"])]
    display_gaps = [item for item in gaps if _is_displayable_requirement(item["requirement"])]
    display_mandatory_gaps = [item for item in display_gaps if item["mandatory"]]

    actions = []
    for item in display_mandatory_gaps[:3]:
        actions.append({
            "requirement": item["requirement"],
            "message": (
                f"Nếu bạn đã có kinh nghiệm về {item['requirement']}, hãy bổ sung vào CV; "
                "nếu chưa có, ưu tiên tìm hiểu hoặc thực hành thêm trước khi ứng tuyển."
            ),
        })

    breakdown = []
    for criterion in evidence.get("criteria") or []:
        if not isinstance(criterion, Mapping):
            continue
        criterion_id = str(criterion.get("criterion_id") or "")
        breakdown.append({
            "criterion_id": criterion_id,
            "label": _CRITERION_LABELS_VI.get(criterion_id, criterion_id),
            "raw_score": float(criterion.get("raw_score") or 0.0),
            "weight": float(criterion.get("weight") or 0.0),
            "weighted_score": float(criterion.get("weighted_score") or 0.0),
            "status": str(criterion.get("status") or "UNKNOWN"),
            "reason": str(criterion.get("reason") or "Chưa có diễn giải."),
        })

    return {
        "verdict": verdict,
        "confidence_message": confidence_message,
        "mandatory_summary": {
            "matched": matched_mandatory,
            "total": total_mandatory,
            "failed": mandatory_failed,
        },
        "matched_requirements": display_supported[:4],
        "priority_gaps": display_gaps[:4],
        "priority_actions": actions,
        "score_breakdown": breakdown,
    }


class TopJobRecommendationService:
    """Orchestrator for the Top Jobs recommendation workflow."""

    def __init__(self, *, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def load_cv_snapshot(
        self,
        db: AsyncSession,
        user_id: str,
        cv_snapshot_id: str,
    ) -> CVSnapshot:
        """Load and verify ownership of the requested CV snapshot."""
        snapshot = await db.scalar(
            select(CVSnapshot).where(
                CVSnapshot.id == cv_snapshot_id,
                CVSnapshot.user_id == user_id,
            )
        )
        if snapshot is None:
            raise ValueError(f"CV snapshot '{cv_snapshot_id}' not found or does not belong to user.")
        return snapshot

    async def create_run(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        cv_snapshot_id: str,
        request: JobRecommendationRequest,
        cache_trace_id: str | None = None,
    ) -> JobRecommendationRun:
        """Initialize a tracked recommendation run record."""
        trace_id = cache_trace_id or f"TRACE_REC_{uuid.uuid4().hex[:12].upper()}"
        run = JobRecommendationRun(
            id=uuid.uuid4().hex,
            user_id=user_id,
            cv_snapshot_id=cv_snapshot_id,
            status="RUNNING",
            filter_json=request.model_dump(),
            retrieval_config_json={
                "bm25_k": self.settings.job_recommend_bm25_k,
                "vector_k": self.settings.job_recommend_vector_k,
                "candidate_k": self.settings.job_recommend_candidate_k,
                "final_k": self.settings.job_recommend_final_k,
                "rrf_k": self.settings.job_recommend_rrf_k,
                "bm25_weight": self.settings.job_recommend_bm25_weight,
                "vector_weight": self.settings.job_recommend_vector_weight,
                "must_have_threshold": self.settings.job_recommend_must_have_threshold,
                "score_cap": self.settings.job_recommend_score_cap,
            },
            pipeline_version=CURRENT_PIPELINE_VERSION,
            normalization_version=CURRENT_NORMALIZATION_VERSION,
            embedding_model=self.settings.vector_embedding_model,
            rubric_version=CURRENT_RUBRIC_VERSION,
            trace_id=trace_id,
        )
        db.add(run)
        await db.flush()
        return run

    async def retrieve_candidates(
        self,
        *,
        cv_retrieval_text: str,
        filtered_jobs: list[dict[str, Any]],
        candidate_k: int,
    ) -> list[RankedJob]:
        """Retrieve candidate jobs via BM25 + Vector + RRF, or return catalog directly if small."""
        if len(filtered_jobs) <= candidate_k:
            return [
                RankedJob(
                    jd_snapshot_id=_extract_job_id(job),
                    rank=idx,
                    score=1.0,
                )
                for idx, job in enumerate(filtered_jobs, start=1)
            ]

        bm25_retriever = BM25Retriever()
        bm25_results = bm25_retriever.retrieve(
            cv_retrieval_text,
            filtered_jobs,
            k=self.settings.job_recommend_bm25_k,
        )

        try:
            semantic_retriever = SemanticRetriever(settings=self.settings)
            vector_results = await semantic_retriever.retrieve(
                cv_retrieval_text,
                k=self.settings.job_recommend_vector_k,
            )
        except Exception as exc:
            logger.warning(
                "Semantic retrieval failed during candidate retrieval; falling back to BM25 only: %s",
                exc,
            )
            vector_results = []

        # The vector index covers the whole catalog.  It must not undo hard
        # filters (location, remote-only, work mode, job type) applied above.
        allowed_job_ids = {_extract_job_id(job) for job in filtered_jobs}
        bm25_results = [item for item in bm25_results if item.jd_snapshot_id in allowed_job_ids]
        vector_results = [item for item in vector_results if item.jd_snapshot_id in allowed_job_ids]

        fused_candidates = weighted_rrf(
            bm25_results,
            vector_results,
            rrf_k=self.settings.job_recommend_rrf_k,
            bm25_weight=self.settings.job_recommend_bm25_weight,
            vector_weight=self.settings.job_recommend_vector_weight,
            candidate_k=candidate_k,
        )
        job_catalog_map = {_extract_job_id(job): job for job in filtered_jobs}
        for job in filtered_jobs:
            job["ready_candidate_boost"] = _ready_candidate_boost(job, cv_retrieval_text)
        reserved_candidates = _reserve_ready_role_candidates(
            fused_candidates,
            job_catalog_map,
            candidate_k=candidate_k,
            reserve=getattr(self.settings, "job_recommend_ready_candidate_reserve", DEFAULT_READY_CANDIDATE_RESERVE),
        )
        return _rerank_by_metadata_preference(reserved_candidates, job_catalog_map)

    async def evaluate_candidate(
        self,
        db: AsyncSession,
        *,
        cv_snapshot: CVSnapshot,
        candidate_retrieval: RankedJob,
        job_catalog_map: Mapping[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """Reuse a completed Match or evaluate the job for the Top-10 preview."""
        jd_id = candidate_retrieval.jd_snapshot_id
        existing_match = await find_existing_match(
            db,
            cv_snapshot_id=cv_snapshot.id,
            jd_snapshot_id=jd_id,
            pipeline_version=CURRENT_PIPELINE_VERSION,
            rubric_version=CURRENT_RUBRIC_VERSION,
        )
        if existing_match is None:
            # A Top-10 result must be ranked by CV–JD fit, not merely retrieval
            # relevance.  Keep this preview evaluation ephemeral: a full MatchRun
            # is still created only when the candidate explicitly asks for the
            # detailed CV–JD analysis.
            job_data = job_catalog_map.get(jd_id) or {}
            requirements_text = "\n".join(
                part
                for part in (
                    str(job_data.get("description") or "").strip(),
                    "Kỹ năng yêu cầu: " + ", ".join(map(str, job_data.get("skills") or [])),
                )
                if part
            )
            evidence = build_cv_jd_evidence(
                cv_text=cv_snapshot.raw_text,
                parsed_cv=dict(cv_snapshot.profile_json or {}),
                jd_title=str(job_data.get("title") or "Job"),
                jd_requirements=requirements_text,
                jd_parsed={"skills": list(job_data.get("skills") or [])},
            )
            coverage = float(evidence.get("must_have_coverage") or 0.0)
            raw_score = float(evidence.get("match_score") or 0.0)
            gate_res = apply_mandatory_gate(
                raw_score,
                must_have_coverage=coverage,
                threshold=self.settings.job_recommend_must_have_threshold,
                score_cap=self.settings.job_recommend_score_cap,
            )
            requirements = evidence.get("requirements") or {}
            mandatory_matched, mandatory_total = _calculate_mandatory_counts(requirements)
            conf_res = calculate_evidence_confidence(evidence)
            exp_res = generate_deterministic_explanations(evidence, lang="vi")
            top_strengths = exp_res.top_strengths or list(evidence.get("strengths") or [])[:4]
            top_gaps = exp_res.top_gaps or list(evidence.get("risks") or [])[:4]
            user_explanation = _build_user_explanation(
                evidence,
                display_score=gate_res.display_score,
                confidence_level=conf_res.confidence_level,
                mandatory_failed=gate_res.failed,
            )
            role_relevant = bool(job_data.get("role_relevant", True))
            role_track = str(job_data.get("role_track") or ("primary" if role_relevant else "mismatch"))
            role_reason = str(job_data.get("role_reason") or "")
            application_ready = not gate_res.failed
            user_explanation.update(
                {"role_relevant": role_relevant, "role_track": role_track, "role_reason": role_reason, "application_ready": application_ready}
            )
            retrieval_trace = {
                "retrieval_rank": candidate_retrieval.rank,
                "role_affinity_score": float(job_data.get("role_affinity_score") or 0.0),
                "ready_candidate_boost": float(job_data.get("ready_candidate_boost") or 0.0),
            }
            return {
                "job_id": str(job_data.get("source_id") or jd_id),
                "jd_snapshot_id": jd_id,
                "title": str(job_data.get("title") or "Job"),
                "company": job_data.get("company"),
                "location": job_data.get("location"),
                "work_mode": job_data.get("work_mode") or job_data.get("remote_type"),
                "source_url": job_data.get("source_url"),
                "source_name": job_data.get("source_name") or job_data.get("source"),
                "seniority": job_data.get("seniority") or job_data.get("job_level"),
                "employment_type": job_data.get("employment_type"),
                "salary": job_data.get("salary") or job_data.get("salary_range"),
                "openings": job_data.get("openings") or job_data.get("quantity"),
                "deadline": job_data.get("deadline") or job_data.get("application_deadline"),
                "posted_at": job_data.get("posted_at") or job_data.get("crawl_date") or job_data.get("created_at"),
                "applicant_count": job_data.get("applicant_count"),
                "company_logo": job_data.get("company_logo") or job_data.get("logo_url"),
                "required_skills": job_data.get("required_skills") or job_data.get("must_have_skills") or [],
                "preferred_skills": job_data.get("preferred_skills") or job_data.get("nice_to_have_skills") or [],
                "skills": job_data.get("skills") or [],
                "display_fit_score": gate_res.display_score,
                "raw_fit_score": raw_score,
                "required_skills_coverage": coverage,
                "mandatory_requirements_matched": mandatory_matched,
                "total_mandatory_requirements": mandatory_total,
                "supported_requirements_count": conf_res.verified_count,
                "rrf_rank": candidate_retrieval.rank,
                "evidence_confidence": conf_res.confidence_level,
                "confidence_score": conf_res.confidence_score,
                "mandatory_requirement_failed": gate_res.failed,
                "role_relevant": role_relevant,
                "role_track": role_track,
                "role_reason": role_reason,
                "application_ready": application_ready,
                **retrieval_trace,
                "match_id": f"PREVIEW_{jd_id}",
                "score_breakdown": list(evidence.get("criteria") or []),
                "top_strengths": top_strengths[:4],
                "top_gaps": top_gaps[:4],
                "user_explanation": user_explanation,
                "mandatory_gate_json": {
                    **gate_res.gate_json,
                    "matched_requirements": mandatory_matched,
                    "total_requirements": mandatory_total,
                },
                "explanation_json": {
                    **exp_res.explanation_json,
                    "evaluation_status": "PREVIEW_EVALUATED",
                    "top_strengths": top_strengths[:4],
                    "top_gaps": top_gaps[:4],
                    "score_breakdown": list(evidence.get("criteria") or []),
                    "user_explanation": user_explanation,
                    "role_relevant": role_relevant,
                    "role_track": role_track,
                    "role_reason": role_reason,
                    "application_ready": application_ready,
                    **retrieval_trace,
                },
                "fit_label": get_fit_label(gate_res.display_score, application_ready=application_ready),
            }
        job_data = job_catalog_map.get(jd_id) or {"source_id": jd_id, "title": "Vị trí tuyển dụng"}

        match_result = existing_match

        # 1. Rubric Fit Score
        criteria = match_result.result_json.get("criteria", [])
        fit_score_res = calculate_fit_score(criteria, decimal_places=1)

        # 2. Mandatory Gate
        req_group = match_result.result_json.get("requirements", {})
        mandatory_reqs_matched, mandatory_reqs_total = _calculate_mandatory_counts(req_group)
        coverage = (mandatory_reqs_matched / mandatory_reqs_total) if mandatory_reqs_total > 0 else 1.0

        gate_res = apply_mandatory_gate(
            fit_score_res.raw_fit_score,
            must_have_coverage=coverage,
            threshold=self.settings.job_recommend_must_have_threshold,
            score_cap=self.settings.job_recommend_score_cap,
        )

        # 3. Evidence Confidence
        conf_res = calculate_evidence_confidence(match_result.result_json)

        # 4. Deterministic Explanations
        exp_res = generate_deterministic_explanations(match_result.result_json, lang="vi")
        user_explanation = _build_user_explanation(
            match_result.result_json,
            display_score=gate_res.display_score,
            confidence_level=conf_res.confidence_level,
            mandatory_failed=gate_res.failed,
        )
        role_relevant = bool(job_data.get("role_relevant", True))
        role_track = str(job_data.get("role_track") or ("primary" if role_relevant else "mismatch"))
        role_reason = str(job_data.get("role_reason") or "")
        application_ready = not gate_res.failed
        user_explanation.update(
            {"role_relevant": role_relevant, "role_track": role_track, "role_reason": role_reason, "application_ready": application_ready}
        )
        retrieval_trace = {
            "retrieval_rank": candidate_retrieval.rank,
            "role_affinity_score": float(job_data.get("role_affinity_score") or 0.0),
            "ready_candidate_boost": float(job_data.get("ready_candidate_boost") or 0.0),
        }

        return {
            "job_id": str(job_data.get("source_id") or jd_id),
            "jd_snapshot_id": jd_id,
            "title": str(job_data.get("title") or "Vị trí tuyển dụng"),
            "company": job_data.get("company"),
            "location": job_data.get("location"),
            "work_mode": job_data.get("work_mode") or job_data.get("remote_type"),
            "source_url": job_data.get("source_url"),
            "source_name": job_data.get("source_name") or job_data.get("source"),
            "seniority": job_data.get("seniority") or job_data.get("job_level"),
            "employment_type": job_data.get("employment_type"),
            "salary": job_data.get("salary") or job_data.get("salary_range"),
            "openings": job_data.get("openings") or job_data.get("quantity"),
            "deadline": job_data.get("deadline") or job_data.get("application_deadline"),
            "posted_at": job_data.get("posted_at") or job_data.get("crawl_date") or job_data.get("created_at"),
            "applicant_count": job_data.get("applicant_count"),
            "company_logo": job_data.get("company_logo") or job_data.get("logo_url"),
            "required_skills": job_data.get("required_skills") or job_data.get("must_have_skills") or [],
            "preferred_skills": job_data.get("preferred_skills") or job_data.get("nice_to_have_skills") or [],
            "skills": job_data.get("skills") or [],
            "display_fit_score": gate_res.display_score,
            "raw_fit_score": fit_score_res.raw_fit_score,
            "required_skills_coverage": coverage,
            "mandatory_requirements_matched": mandatory_reqs_matched,
            "total_mandatory_requirements": mandatory_reqs_total,
            "supported_requirements_count": conf_res.verified_count,
            "rrf_rank": candidate_retrieval.rank,
            "evidence_confidence": conf_res.confidence_level,
            "confidence_score": conf_res.confidence_score,
            "mandatory_requirement_failed": gate_res.failed,
            "role_relevant": role_relevant,
            "role_track": role_track,
            "role_reason": role_reason,
            "application_ready": application_ready,
            **retrieval_trace,
            "match_id": match_result.id,
            "score_breakdown": [
                {
                    "criterion_id": b.criterion_id,
                    "raw_score": b.raw_score,
                    "weight": b.normalized_weight,
                    "weighted_score": b.weighted_score,
                }
                for b in fit_score_res.breakdown
            ],
            "top_strengths": exp_res.top_strengths,
            "top_gaps": exp_res.top_gaps,
            "user_explanation": user_explanation,
            "mandatory_gate_json": {
                **gate_res.gate_json,
                "matched_requirements": mandatory_reqs_matched,
                "total_requirements": mandatory_reqs_total,
            },
            "explanation_json": {
                **exp_res.explanation_json,
                "user_explanation": user_explanation,
                "role_relevant": role_relevant,
                "role_track": role_track,
                "role_reason": role_reason,
                "application_ready": application_ready,
                **retrieval_trace,
            },
        }

    async def recommend_jobs(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        request: JobRecommendationRequest,
        catalog: Sequence[dict[str, Any]] | None = None,
        cache_trace_id: str | None = None,
    ) -> tuple[str, list[RankedTopJob]]:
        """Full Top Jobs recommendation flow returning run ID and Top-10 ranked recommendations."""
        # 1. Load and authorize CV snapshot
        cv_snapshot = await self.load_cv_snapshot(db, user_id, request.cv_snapshot_id)

        # Resolve target role from CV/profile if not explicitly provided in request
        if not request.role:
            target_role = extract_candidate_target_role(cv_snapshot)
            if target_role:
                request = request.model_copy(update={"role": target_role})

        # 2. Initialize tracking Run
        run = await self.create_run(
            db,
            user_id=user_id,
            cv_snapshot_id=cv_snapshot.id,
            request=request,
            cache_trace_id=cache_trace_id,
        )

        try:
            # 3. Load catalog & apply metadata filters
            raw_catalog = catalog if catalog is not None else list(load_enterprise_job_catalog())
            filtered_jobs = apply_filters(raw_catalog, request)

            if not filtered_jobs:
                # No jobs matching hard filters
                run.status = "COMPLETED"
                run.completed_at = datetime.now(UTC)
                await db.flush()
                return run.id, []

            job_map = {_extract_job_id(job): job for job in filtered_jobs}

            # 4. PII-free CV retrieval query text
            cv_retrieval_text = build_cv_retrieval_text(cv_snapshot)

            # 5. Retrieve candidates (BM25 + Semantic + RRF)
            candidates = await self.retrieve_candidates(
                cv_retrieval_text=cv_retrieval_text,
                filtered_jobs=filtered_jobs,
                candidate_k=self.settings.job_recommend_candidate_k,
            )

            # 6. Evaluate each candidate
            evaluations: list[dict[str, Any]] = []
            for candidate in candidates:
                eval_data = await self.evaluate_candidate(
                    db,
                    cv_snapshot=cv_snapshot,
                    candidate_retrieval=candidate,
                    job_catalog_map=job_map,
                )
                evaluations.append(eval_data)

            # 7. Final 5-level deterministic ranking & Top-10 selection
            final_k = self.settings.job_recommend_final_k
            top_ranked_jobs = rank_top_jobs(evaluations, top_k=final_k, lang="vi")

            candidate_ranks = {candidate.jd_snapshot_id: candidate.rank for candidate in candidates}
            selected_ranks = {job.jd_snapshot_id: job.rank for job in top_ranked_jobs}
            evaluation_by_id = {str(item["jd_snapshot_id"]): item for item in evaluations}
            diagnostic_items = []
            for job_id, job in job_map.items():
                candidate_rank = candidate_ranks.get(job_id)
                final_rank = selected_ranks.get(job_id)
                phase = "selected" if final_rank is not None else (
                    "evaluated_not_selected" if candidate_rank is not None else "not_retrieved"
                )
                evaluation = evaluation_by_id.get(job_id, {})
                gate = dict(evaluation.get("mandatory_gate_json") or {})
                diagnostic_items.append({
                    "job_id": str(job.get("source_id") or job_id),
                    "title": str(job.get("title") or "Job"),
                    "phase": phase,
                    "retrieval_rank": candidate_rank,
                    "final_rank": final_rank,
                    "role_relevant": bool(job.get("role_relevant", True)),
                    "role_track": str(job.get("role_track") or "mismatch"),
                    "role_reason": str(job.get("role_reason") or ""),
                    "role_affinity_score": float(job.get("role_affinity_score") or 0.0),
                    "ready_candidate_boost": float(job.get("ready_candidate_boost") or 0.0),
                    "raw_fit_score": evaluation.get("raw_fit_score"),
                    "display_fit_score": evaluation.get("display_fit_score"),
                    "mandatory_requirement_failed": evaluation.get("mandatory_requirement_failed"),
                    "mandatory_coverage": gate.get("coverage"),
                    "mandatory_matched": gate.get("matched_requirements"),
                    "mandatory_total": gate.get("total_requirements"),
                    "selection_reason": (
                        "Selected in Top 10."
                        if final_rank is not None else
                        "Evaluated but ranked below the Top 10 cutoff."
                        if candidate_rank is not None else "Not included in retrieval candidate pool."
                    ),
                })
            run.filter_json = {
                **dict(run.filter_json or {}),
                "candidate_diagnostic": {
                    "candidate_count": len(candidates),
                    "evaluated_count": len(evaluations),
                    "items": diagnostic_items,
                },
            }

            # 8. Persist Top-10 recommendations to DB
            await persist_top_recommendations(db, run.id, top_ranked_jobs)

            # 9. Mark run as COMPLETED
            run.status = "COMPLETED"
            run.completed_at = datetime.now(UTC)
            await db.flush()

            return run.id, top_ranked_jobs

        except Exception as exc:
            logger.exception("Job recommendation run failed: %s", exc)
            run.status = "FAILED"
            run.completed_at = datetime.now(UTC)
            await db.flush()
            raise


# Singleton instance
_service = TopJobRecommendationService()


def get_recommendation_service() -> TopJobRecommendationService:
    return _service
