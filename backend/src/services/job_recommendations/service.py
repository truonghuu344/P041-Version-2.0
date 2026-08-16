"""Top Jobs recommendation orchestration service.

Executes the complete, reproducible Top Jobs recommendation pipeline:
1. Load and authorize the candidate-owned CV snapshot.
2. Create an initial JobRecommendationRun tracking record.
3. Apply deterministic metadata hard/soft filters over the job catalog.
4. Retrieve candidate jobs:
   - If filtered jobs <= candidate_k (default 30): use all filtered jobs.
   - Else: run BM25 and Semantic retrievers, then merge via Weighted RRF (top candidate_k).
5. For each candidate:
   - Check and reuse existing Match results; run matching pipeline only when needed.
   - Calculate rubric Fit Score with dynamic active-weight normalization.
   - Apply the Mandatory Requirement Gate (capping display score at 49 when coverage < 50%).
   - Calculate Evidence Confidence (high / medium / low).
   - Generate deterministic, auditable Strengths and Gaps explanations.
6. Apply deterministic 5-level tie-breaking final ranking.
7. Select Top-10 (or top_k), persist to database, mark run COMPLETED, and return results.
"""

from __future__ import annotations

import logging
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
from src.services.cv_jd_pipeline import PipelineConfig, run_cv_jd_pipeline

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
    persist_top_recommendations,
    rank_top_jobs,
)

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.fit_score import calculate_fit_score

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.mandatory_gate import apply_mandatory_gate

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.match_reuse import get_or_run_match

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.rrf import weighted_rrf

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.semantic_retriever import SemanticRetriever

logger = logging.getLogger(__name__)

CURRENT_PIPELINE_VERSION = "2.0"
CURRENT_NORMALIZATION_VERSION = "1.0"
CURRENT_RUBRIC_VERSION = "1.0"


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
    ) -> JobRecommendationRun:
        """Initialize a tracked recommendation run record."""
        trace_id = f"TRACE_REC_{uuid.uuid4().hex[:12].upper()}"
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

        semantic_retriever = SemanticRetriever(settings=self.settings)
        vector_results = await semantic_retriever.retrieve(
            cv_retrieval_text,
            k=self.settings.job_recommend_vector_k,
        )

        fused_candidates = weighted_rrf(
            bm25_results,
            vector_results,
            rrf_k=self.settings.job_recommend_rrf_k,
            bm25_weight=self.settings.job_recommend_bm25_weight,
            vector_weight=self.settings.job_recommend_vector_weight,
            candidate_k=candidate_k,
        )
        return fused_candidates

    async def evaluate_candidate(
        self,
        db: AsyncSession,
        *,
        cv_snapshot: CVSnapshot,
        candidate_retrieval: RankedJob,
        job_catalog_map: Mapping[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """Evaluate a single candidate using reuse-aware match, fit score, gate, and explanation."""
        jd_id = candidate_retrieval.jd_snapshot_id
        job_data = job_catalog_map.get(jd_id) or {"source_id": jd_id, "title": "Vị trí tuyển dụng"}

        # Define inline pipeline runner for fresh matches
        async def _run_fresh_match(
            _db: AsyncSession,
            *,
            cv_snapshot_id: str,
            jd_snapshot_id: str,
            **_kwargs: Any,
        ) -> dict[str, Any]:
            requirements = _extract_job_requirements(job_data)
            pipeline_cfg = PipelineConfig(
                bm25_top_k=self.settings.cv_jd_bm25_top_k,
                semantic_top_k=self.settings.cv_jd_semantic_top_k,
                semantic_min_score=self.settings.cv_jd_semantic_min_score,
                rrf_k=self.settings.cv_jd_rrf_k,
                hybrid_top_k=self.settings.cv_jd_hybrid_top_k,
                max_evidence_per_requirement=self.settings.cv_jd_evidence_max_per_requirement,
                score_decimal_places=self.settings.cv_jd_score_decimal_places,
                embedding_provider=self.settings.cv_jd_embedding_provider,
                embedding_model=self.settings.cv_jd_embedding_model,
                embedding_api_key=self.settings.google_genai_api_key,
                embedding_dimensions=self.settings.cv_jd_embedding_dimensions,
                rating_poor_max=self.settings.cv_jd_rating_poor_max,
                rating_average_max=self.settings.cv_jd_rating_average_max,
                rating_good_max=self.settings.cv_jd_rating_good_max,
                extraction_min_confidence=self.settings.cv_jd_extraction_min_confidence,
            )
            return run_cv_jd_pipeline(
                cv_text=cv_snapshot.raw_text or "",
                parsed_cv=cv_snapshot.profile_json or {},
                job_id=jd_id,
                requirements=requirements,
                config=pipeline_cfg,
            )

        match_result = await get_or_run_match(
            db,
            cv_snapshot_id=cv_snapshot.id,
            jd_snapshot_id=jd_id,
            pipeline_version=CURRENT_PIPELINE_VERSION,
            rubric_version=CURRENT_RUBRIC_VERSION,
            run_pipeline=_run_fresh_match,
        )

        # 1. Rubric Fit Score
        criteria = match_result.result_json.get("criteria", [])
        fit_score_res = calculate_fit_score(criteria, decimal_places=1)

        # 2. Mandatory Gate
        req_group = match_result.result_json.get("requirements", {})
        matched_reqs = req_group.get("matched", [])
        missing_reqs = req_group.get("missing", [])
        mandatory_reqs_total = sum(1 for r in matched_reqs + missing_reqs if isinstance(r, dict) and r.get("mandatory"))
        mandatory_reqs_matched = sum(1 for r in matched_reqs if isinstance(r, dict) and r.get("mandatory"))
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

        return {
            "job_id": str(job_data.get("source_id") or jd_id),
            "jd_snapshot_id": jd_id,
            "title": str(job_data.get("title") or "Vị trí tuyển dụng"),
            "company": job_data.get("company"),
            "location": job_data.get("location"),
            "work_mode": job_data.get("work_mode") or job_data.get("remote_type"),
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
            "match_id": match_result.match_id,
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
            "mandatory_gate_json": {
                **gate_res.gate_json,
                "matched_requirements": mandatory_reqs_matched,
                "total_requirements": mandatory_reqs_total,
            },
            "explanation_json": exp_res.explanation_json,
        }

    async def recommend_jobs(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        request: JobRecommendationRequest,
        catalog: Sequence[dict[str, Any]] | None = None,
    ) -> tuple[str, list[RankedTopJob]]:
        """Full Top Jobs recommendation flow returning run ID and Top-10 ranked recommendations."""
        # 1. Load and authorize CV snapshot
        cv_snapshot = await self.load_cv_snapshot(db, user_id, request.cv_snapshot_id)

        # 2. Initialize tracking Run
        run = await self.create_run(db, user_id=user_id, cv_snapshot_id=cv_snapshot.id, request=request)

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
