from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CV,
    CandidateArtifact,
    CriterionEvaluationArtifact,
    CVCertificationArtifact,
    CVChunkArtifact,
    CVEducationArtifact,
    CVExperienceArtifact,
    CVLanguageArtifact,
    CVProfileArtifact,
    CVProjectArtifact,
    CVSkillArtifact,
    DocumentArtifact,
    JDRequirementArtifact,
    JobArtifact,
    JobDescription,
    MatchEvidenceArtifact,
    MatchResultArtifact,
    MatchRun,
    RetrievalArtifact,
    RubricCriterionDefinition,
    RubricDefinition,
)
from src.services.cv_jd_pipeline import DEFAULT_RUBRIC
from src.services.pipeline_context import PIPELINE_VERSION, get_or_create_cv_snapshot, get_or_create_jd_snapshot
from src.config import get_settings


def _evaluated_requirements(result: dict[str, Any]) -> list[dict[str, Any]]:
    groups = result.get("requirements") or {}
    return [item for name in ("matched", "partial", "missing", "uncertain") for item in groups.get(name, [])]


def _pages(raw_text: str) -> list[dict[str, Any]]:
    markers = list(re.finditer(r"(?m)^\[PAGE\s+(\d+)\]\s*$", raw_text))
    if not markers:
        return [{"page_number": 1, "text": raw_text}] if raw_text else []
    pages = []
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(raw_text)
        pages.append({"page_number": int(marker.group(1)), "text": raw_text[marker.end() : end].strip()})
    return pages


def _cv_records(model: type, match_id: str, records: list[dict[str, Any]]) -> list[Any]:
    return [
        model(match_id=match_id, source_page=item.get("source_page"), payload_json=item)
        for item in records
    ]


def _pipeline_config_snapshot() -> dict[str, Any]:
    """Persist score-affecting settings so a Match can be reproduced later."""
    settings = get_settings()
    return {
        "embedding": {
            "provider": settings.cv_jd_embedding_provider,
            "model": settings.cv_jd_embedding_model,
            "dimensions": settings.cv_jd_embedding_dimensions,
        },
        "retrieval": {
            "bm25_top_k": settings.cv_jd_bm25_top_k,
            "semantic_top_k": settings.cv_jd_semantic_top_k,
            "semantic_min_score": settings.cv_jd_semantic_min_score,
            "rrf_k": settings.cv_jd_rrf_k,
            "hybrid_top_k": settings.cv_jd_hybrid_top_k,
        },
        "evaluation": {
            "evidence_max_per_requirement": settings.cv_jd_evidence_max_per_requirement,
            "extraction_min_confidence": settings.cv_jd_extraction_min_confidence,
            "score_decimal_places": settings.cv_jd_score_decimal_places,
            "rating_thresholds": {
                "poor_max": settings.cv_jd_rating_poor_max,
                "average_max": settings.cv_jd_rating_average_max,
                "good_max": settings.cv_jd_rating_good_max,
            },
        },
    }


async def persist_match_artifacts(
    db: AsyncSession,
    *,
    user_id: str,
    cv_id: str,
    jd_id: str,
    analysis_id: str | None,
    result: dict[str, Any],
    match: MatchRun | None = None,
) -> MatchRun:
    """Persist the complete score → criterion → requirement → evidence → chunk chain."""
    result.setdefault("match_id", f"MATCH_{uuid.uuid4().hex.upper()[:12]}")
    result.setdefault("status", "COMPLETED")
    result.setdefault("final_score", float(result.get("match_score", 0.0)))
    result.setdefault("rating", "POOR")
    if match is None:
        match = MatchRun(id=result["match_id"], user_id=user_id, cv_id=cv_id, jd_id=jd_id)
        db.add(match)
    match.analysis_id = analysis_id
    match.trace_id = result.get("trace_id")
    match.status = result.get("status", "COMPLETED")
    match.current_step = result.get("status", "COMPLETED")
    match.final_score = result.get("final_score")
    match.rating = result.get("rating")
    match.mandatory_requirement_failed = result.get("mandatory_requirement_failed", False)
    match.rubric_id = match.rubric_id or "RUBRIC_DEFAULT_V1"
    match.pipeline_config_json = _pipeline_config_snapshot()
    match.versions_json = result.get("versions", {})
    match.result_json = result
    match.completed_at = datetime.now(UTC) if result.get("status") == "COMPLETED" else None
    await db.flush()

    structured_cv = dict(result.get("structured_cv") or {})
    structured_jd = dict(result.get("structured_jd") or {})
    candidate_id = str(result.get("candidate_id") or structured_cv.get("candidate_id") or "")
    if candidate_id and await db.get(CandidateArtifact, candidate_id) is None:
        profile = dict(structured_cv.get("candidate") or {})
        db.add(
            CandidateArtifact(
                id=candidate_id,
                user_id=user_id,
                current_title=profile.get("current_title"),
                location=profile.get("location"),
                profile_json=profile,
            )
        )

    cv = await db.get(CV, cv_id)
    jd = await db.get(JobDescription, jd_id)
    if cv and jd:
        cv_snapshot = await get_or_create_cv_snapshot(db, cv)
        jd_snapshot = await get_or_create_jd_snapshot(db, jd)
        match.cv_snapshot_id = cv_snapshot.id
        match.jd_snapshot_id = jd_snapshot.id
        match.pipeline_version = PIPELINE_VERSION
    cv_document_id = f"DOC_CV_{match.cv_snapshot_id or cv_id}"
    if await db.get(DocumentArtifact, cv_document_id) is None:
        cv_raw_text = (cv_snapshot.raw_text if cv and jd else (cv.raw_text if cv else "")) or ""
        db.add(
            DocumentArtifact(
                id=cv_document_id,
                user_id=user_id,
                document_type="CV",
                source_entity_id=cv_id,
                source_snapshot_id=match.cv_snapshot_id,
                raw_text=cv_raw_text,
                structured_json=(cv_snapshot.profile_json if cv and jd else (cv.parsed_json if cv else {})) or {},
                normalized_json=structured_cv,
                pages_json=(cv_snapshot.pages_json if cv and jd else _pages(cv_raw_text)),
            )
        )
    jd_document_id = f"DOC_JD_{match.jd_snapshot_id or jd_id}"
    if await db.get(DocumentArtifact, jd_document_id) is None:
        jd_raw_text = (jd_snapshot.raw_text if cv and jd else (jd.requirements_text if jd else "")) or ""
        db.add(
            DocumentArtifact(
                id=jd_document_id,
                user_id=user_id,
                document_type="JD",
                source_entity_id=jd_id,
                source_snapshot_id=match.jd_snapshot_id,
                raw_text=jd_raw_text,
                structured_json=(jd_snapshot.requirements_json if cv and jd else (jd.normalized_json if jd else {})) or {},
                normalized_json=structured_jd,
                pages_json=(jd_snapshot.pages_json if cv and jd else _pages(jd_raw_text)),
            )
        )

    job_artifact_id = f"JOB_{jd_id}"
    if await db.get(JobArtifact, job_artifact_id) is None:
        job_data = dict(structured_jd.get("job") or {})
        db.add(
            JobArtifact(
                id=job_artifact_id,
                source_jd_id=jd_id,
                title_original=(jd.title if jd else "") or str(job_data.get("title_original") or ""),
                title_normalized=job_data.get("title_normalized"),
                structured_json=structured_jd,
            )
        )

    rubric_id = match.rubric_id or "RUBRIC_DEFAULT_V1"
    if await db.get(RubricDefinition, rubric_id) is None:
        db.add(
            RubricDefinition(
                id=rubric_id,
                name="CV-JD Default Rubric",
                version=str(result.get("versions", {}).get("rubric", "1.0")),
                config_json={
                    "criteria": [
                        {"criterion_id": criterion_id, "weight": weight, "enabled": True}
                        for criterion_id, weight in DEFAULT_RUBRIC.items()
                    ]
                },
            )
        )
        await db.flush()
        db.add_all(
            [
                RubricCriterionDefinition(
                    rubric_id=rubric_id,
                    criterion_id=criterion_id,
                    weight=weight,
                    enabled=True,
                    config_json={},
                )
                for criterion_id, weight in DEFAULT_RUBRIC.items()
            ]
        )

    db.add(CVProfileArtifact(match_id=match.id, candidate_id=candidate_id, payload_json=structured_cv))
    db.add_all(_cv_records(CVExperienceArtifact, match.id, structured_cv.get("experience", [])))
    db.add_all(_cv_records(CVProjectArtifact, match.id, structured_cv.get("projects", [])))
    db.add_all(_cv_records(CVEducationArtifact, match.id, structured_cv.get("education", [])))
    db.add_all(_cv_records(CVCertificationArtifact, match.id, structured_cv.get("certifications", [])))
    db.add_all(_cv_records(CVLanguageArtifact, match.id, structured_cv.get("languages", [])))
    db.add_all(
        [
            CVSkillArtifact(
                match_id=match.id,
                original_name=str(item.get("original_name") or item.get("normalized_name") or ""),
                normalized_name=str(item.get("normalized_name") or item.get("original_name") or ""),
                source_page=item.get("source_page"),
                payload_json=item,
            )
            for item in structured_cv.get("skills", [])
        ]
    )
    embeddings = {item["chunk_id"]: item for item in result.get("embedding_records", [])}

    db.add_all(
        [
            CVChunkArtifact(
                match_id=match.id,
                chunk_id=item["chunk_id"],
                candidate_id=item["candidate_id"],
                document_id=item["document_id"],
                chunk_type=item["chunk_type"],
                text=item["text"],
                normalized_text=item["normalized_text"],
                source_section=item.get("source_section"),
                source_page=item.get("source_page"),
                metadata_json=item.get("metadata", {}),
                embedding_model=(embeddings.get(item["chunk_id"]) or {}).get("model"),
                embedding_json=(embeddings.get(item["chunk_id"]) or {}).get("vector"),
            )
            for item in result.get("cv_chunks", [])
        ]
    )
    db.add_all(
        [
            JDRequirementArtifact(
                match_id=match.id,
                requirement_id=item["requirement_id"],
                requirement_type=item["requirement_type"],
                text=item.get("text") or str(item.get("normalized_value") or ""),
                mandatory=bool(item.get("mandatory")),
                priority=str(item.get("priority") or "medium"),
                status=item.get("status"),
                criterion_score=item.get("criterion_score"),
                payload_json=item,
            )
            for item in _evaluated_requirements(result)
        ]
    )
    db.add_all(
        [
            RetrievalArtifact(
                match_id=match.id,
                requirement_id=item["requirement_id"],
                bm25_results_json=item.get("bm25_results", []),
                semantic_results_json=item.get("semantic_results", []),
                hybrid_results_json=item.get("hybrid_results", []),
            )
            for item in result.get("retrieval_results", [])
        ]
    )
    db.add_all(
        [
            MatchEvidenceArtifact(
                match_id=match.id,
                evidence_id=item["evidence_id"],
                requirement_id=item["requirement_id"],
                chunk_id=item["chunk_id"],
                text=item["text"],
                source_page=item.get("source_page"),
                source_section=item.get("source_section"),
                semantic_score=item.get("semantic_score"),
                bm25_score=item.get("bm25_score"),
                fusion_score=item["fusion_score"],
                ranks_json={
                    "semantic_rank": item.get("semantic_rank"),
                    "bm25_rank": item.get("bm25_rank"),
                    "fusion_rank": item.get("fusion_rank"),
                },
            )
            for item in result.get("evidence", [])
        ]
    )
    db.add_all(
        [
            CriterionEvaluationArtifact(
                match_id=match.id,
                criterion_id=item["criterion_id"],
                raw_score=item["raw_score"],
                weight=item["weight"],
                weighted_score=item["weighted_score"],
                status=item["status"],
                reason=item["reason"],
                requirement_ids_json=item.get("requirement_ids", []),
                evidence_ids_json=item.get("evidence_ids", []),
            )
            for item in result.get("criteria", [])
        ]
    )
    db.add(
        MatchResultArtifact(
            match_id=match.id,
            final_score=float(result.get("final_score", 0.0)),
            rating=str(result.get("rating") or "POOR"),
            result_json=result,
        )
    )
    return match
