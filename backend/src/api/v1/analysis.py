import hashlib
import json
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, CVAnalysis, CVOptimizationDecision, JobDescription, UsageEvent, User
from src.models.schemas import (
    CVOptimizationDecisionOut,
    CVOptimizationDecisionRequest,
    GapAnalysisRequest,
    GapAnalysisResponse,
    ResumeOptimizationRequest,
    ResumeOptimizationResponse,
)
from src.services.gap_analysis_service import perform_cv_jd_gap_analysis
from src.services.match_persistence import persist_match_artifacts
from src.services.pipeline_context import PIPELINE_VERSION, get_or_create_cv_snapshot, get_or_create_jd_snapshot
from src.services.resume_optimization_service import optimize_resume_for_jd, validate_resume_change

router = APIRouter(prefix="/analysis", tags=["CV Match & Gap Analysis"])


def _gap_cache_key(*, user_id: str, cv_snapshot_id: str, jd_snapshot_id: str) -> str:
    """Stable key which contains no CV/JD content or personally identifiable data."""
    settings = get_settings()
    payload = {
        "feature": "gap_analysis",
        "user_id": user_id,
        "cv_snapshot_id": cv_snapshot_id,
        "jd_snapshot_id": jd_snapshot_id,
        "pipeline_version": PIPELINE_VERSION,
        "cache_version": settings.gap_analysis_cache_version,
        "explanation_enabled": settings.match_explanation_llm_enabled,
        "model": settings.model_name if settings.match_explanation_llm_enabled else "deterministic",
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def _stored_gap_response(analysis: CVAnalysis, *, cache_hit: bool = False) -> GapAnalysisResponse:
    """Build the API response from the persisted source of truth."""
    payload = dict(analysis.gap_analysis_json or {})
    cache = payload.get("cache") if isinstance(payload.get("cache"), dict) else {}
    return GapAnalysisResponse.model_validate(
        {
            **payload,
            "id": analysis.id,
            "cv_id": analysis.cv_id,
            "jd_id": analysis.jd_id,
            "cv_snapshot_id": analysis.cv_snapshot_id,
            "jd_snapshot_id": analysis.jd_snapshot_id,
            "pipeline_version": analysis.pipeline_version or payload.get("pipeline_version", PIPELINE_VERSION),
            "match_score": analysis.match_score,
            "suggestions": analysis.optimized_suggestions_json or [],
            "created_at": analysis.created_at,
            "cache_hit": cache_hit,
            "cache_key_version": str(cache.get("version") or ""),
        }
    )


@router.post("/gap-analysis", response_model=GapAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_cv_jd_gap(
    payload: GapAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GapAnalysisResponse:
    """Phân tích Match Score & Gap Analysis giữa CV đã upload và JD mục tiêu."""
    started_at = perf_counter()
    # Fetch CV
    stmt_cv = select(CV).where(CV.id == payload.cv_id, CV.user_id == current_user.id)
    res_cv = await db.execute(stmt_cv)
    cv = res_cv.scalar_one_or_none()
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy CV hợp lệ để phân tích",
        )

    # Fetch JD
    stmt_jd = select(JobDescription).where(
        JobDescription.id == payload.jd_id,
        or_(
            JobDescription.is_system.is_(True),
            JobDescription.created_by_user_id == current_user.id,
        ),
    )
    res_jd = await db.execute(stmt_jd)
    jd = res_jd.scalar_one_or_none()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy Job Description hợp lệ để phân tích",
        )

    # Snapshot IDs change whenever the source CV/JD changes. They are the
    # cache boundary, so cached output can never be reused for edited inputs.
    cv_snapshot = await get_or_create_cv_snapshot(db, cv)
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    settings = get_settings()
    cache_key = _gap_cache_key(
        user_id=current_user.id,
        cv_snapshot_id=cv_snapshot.id,
        jd_snapshot_id=jd_snapshot.id,
    )
    if settings.gap_analysis_cache_enabled and not payload.force_refresh:
        cached = await db.scalar(
            select(CVAnalysis)
            .where(
                CVAnalysis.user_id == current_user.id,
                CVAnalysis.cv_snapshot_id == cv_snapshot.id,
                CVAnalysis.jd_snapshot_id == jd_snapshot.id,
                CVAnalysis.pipeline_version == PIPELINE_VERSION,
            )
            .order_by(CVAnalysis.created_at.desc())
            .limit(1)
        )
        cached_metadata_raw = (cached.gap_analysis_json or {}).get("cache", {}) if cached else {}
        cached_metadata = cached_metadata_raw if isinstance(cached_metadata_raw, dict) else {}
        if cached and cached_metadata.get("key") == cache_key:
            return _stored_gap_response(cached, cache_hit=True)

    # Perform analysis
    cv_raw_text = (cv.raw_text or "").strip()
    if not cv_raw_text and cv.parsed_json:
        parsed = cv.parsed_json or {}
        parts = [f"CV Title: {cv.title or ''}"]
        if summary := parsed.get("summary"):
            parts.append(f"Summary: {summary}")
        if skills := parsed.get("skills"):
            parts.append(f"Skills: {', '.join(skills) if isinstance(skills, list) else skills}")
        if exp := parsed.get("experience"):
            parts.append(f"Experience: {exp}")
        cv_raw_text = "\n".join(parts)
    if not cv_raw_text:
        cv_raw_text = cv.title or "Hồ sơ ứng viên"

    jd_reqs = (jd.requirements_text or "").strip()
    if not jd_reqs:
        jd_reqs = f"Tải lên và tối ưu CV theo vị trí {jd.title or 'tuyển dụng'}"

    try:
        analysis_result = await perform_cv_jd_gap_analysis(
            cv_raw_text=cv_raw_text,
            cv_parsed_json={**(cv.parsed_json or {}), "_candidate_id": f"CAND_{current_user.id}"},
            jd_title=jd.title or "Vị trí tuyển dụng",
            jd_requirements=jd_reqs,
            jd_parsed_json={**(jd.normalized_json or {}), "job_id": jd.id},
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("Lỗi khi thực hiện gap analysis: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi thực hiện phân tích CV–JD: {str(exc)}",
        ) from exc

    # Save to database
    new_analysis = CVAnalysis(
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        cv_snapshot_id=cv_snapshot.id,
        jd_snapshot_id=jd_snapshot.id,
        pipeline_version=PIPELINE_VERSION,
        match_score=analysis_result.get("match_score", 0.0),
        gap_analysis_json={
            "pipeline_version": PIPELINE_VERSION,
            "trace_id": analysis_result.get("trace_id", ""),
            "match_id": analysis_result.get("match_id", ""),
            "candidate_id": analysis_result.get("candidate_id", ""),
            "document_id": analysis_result.get("document_id", ""),
            "status": analysis_result.get("status", "COMPLETED"),
            "final_score": analysis_result.get("final_score", analysis_result.get("match_score", 0.0)),
            "rating": analysis_result.get("rating", "POOR"),
            "mandatory_requirement_failed": analysis_result.get("mandatory_requirement_failed", False),
            "criteria": analysis_result.get("criteria", []),
            "requirements": analysis_result.get("requirements", {}),
            "evidence": analysis_result.get("evidence", []),
            "retrieval_results": analysis_result.get("retrieval_results", []),
            "cv_chunks": analysis_result.get("cv_chunks", []),
            "warnings": analysis_result.get("warnings", []),
            "versions": analysis_result.get("versions", {}),
            "processing_trace": analysis_result.get("processing_trace", []),
            "structured_cv": analysis_result.get("structured_cv", {}),
            "structured_jd": analysis_result.get("structured_jd", {}),
            "raw_match_score": analysis_result.get("raw_match_score", analysis_result.get("match_score", 0.0)),
            "match_level": analysis_result.get("match_level", "partial_match"),
            "confidence_score": analysis_result.get("confidence_score", 0.0),
            "confidence_level": analysis_result.get("confidence_level", "low"),
            "must_have_coverage": analysis_result.get("must_have_coverage", 0.0),
            "must_have_gate": analysis_result.get("must_have_gate", {}),
            "hard_skills_matching": analysis_result.get("hard_skills_matching", []),
            "hard_skills_partial": analysis_result.get("hard_skills_partial", []),
            "hard_skills_missing": analysis_result.get("hard_skills_missing", []),
            "soft_skills_gap": analysis_result.get("soft_skills_gap", []),
            "unknown_requirements": analysis_result.get("unknown_requirements", []),
            "requirement_evidence": analysis_result.get("requirement_evidence", []),
            "jd_parsed": analysis_result.get("jd_parsed", {}),
            "strengths": analysis_result.get("strengths", []),
            "risks": analysis_result.get("risks", []),
            "executive_summary": analysis_result.get("executive_summary", ""),
            "priority_actions": analysis_result.get("priority_actions", []),
            "learning_recommendations": analysis_result.get("learning_recommendations", []),
            "certification_recommendations": analysis_result.get("certification_recommendations", []),
            "project_recommendations": analysis_result.get("project_recommendations", []),
            "cv_section_recommendations": analysis_result.get("cv_section_recommendations", []),
            "score_breakdown": analysis_result.get("score_breakdown", {}),
            "integrity_guardrail": analysis_result.get("integrity_guardrail", "passed"),
            "cache": {
                "key": cache_key,
                "version": settings.gap_analysis_cache_version,
                "explanation_enabled": settings.match_explanation_llm_enabled,
            },
        },
        optimized_suggestions_json=analysis_result.get("suggestions", []),
    )
    db.add(new_analysis)
    await db.flush()
    await persist_match_artifacts(
        db,
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        analysis_id=new_analysis.id,
        result=analysis_result,
    )
    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="gap_analysis",
            duration_ms=round((perf_counter() - started_at) * 1000),
            metadata_json={"cv_id": cv.id, "jd_id": jd.id},
        )
    )
    await db.commit()
    await db.refresh(new_analysis)

    return GapAnalysisResponse(
        id=new_analysis.id,
        cv_id=new_analysis.cv_id,
        jd_id=new_analysis.jd_id,
        cv_snapshot_id=new_analysis.cv_snapshot_id,
        jd_snapshot_id=new_analysis.jd_snapshot_id,
        pipeline_version=new_analysis.pipeline_version,
        trace_id=analysis_result.get("trace_id", ""),
        match_id=analysis_result.get("match_id", ""),
        candidate_id=analysis_result.get("candidate_id", ""),
        document_id=analysis_result.get("document_id", ""),
        status=analysis_result.get("status", "COMPLETED"),
        match_score=new_analysis.match_score,
        final_score=analysis_result.get("final_score", new_analysis.match_score),
        rating=analysis_result.get("rating", "POOR"),
        mandatory_requirement_failed=analysis_result.get("mandatory_requirement_failed", False),
        criteria=analysis_result.get("criteria", []),
        requirements=analysis_result.get("requirements", {}),
        evidence=analysis_result.get("evidence", []),
        retrieval_results=analysis_result.get("retrieval_results", []),
        cv_chunks=analysis_result.get("cv_chunks", []),
        warnings=analysis_result.get("warnings", []),
        versions=analysis_result.get("versions", {}),
        processing_trace=analysis_result.get("processing_trace", []),
        structured_cv=analysis_result.get("structured_cv", {}),
        structured_jd=analysis_result.get("structured_jd", {}),
        raw_match_score=analysis_result.get("raw_match_score", new_analysis.match_score),
        match_level=analysis_result.get("match_level", "partial_match"),
        confidence_score=analysis_result.get("confidence_score", 0.0),
        confidence_level=analysis_result.get("confidence_level", "low"),
        must_have_coverage=analysis_result.get("must_have_coverage", 0.0),
        must_have_gate=analysis_result.get("must_have_gate", {}),
        hard_skills_matching=analysis_result.get("hard_skills_matching", []),
        hard_skills_partial=analysis_result.get("hard_skills_partial", []),
        hard_skills_missing=analysis_result.get("hard_skills_missing", []),
        soft_skills_gap=analysis_result.get("soft_skills_gap", []),
        unknown_requirements=analysis_result.get("unknown_requirements", []),
        requirement_evidence=analysis_result.get("requirement_evidence", []),
        strengths=analysis_result.get("strengths", []),
        risks=analysis_result.get("risks", []),
        suggestions=analysis_result.get("suggestions", []),
        executive_summary=analysis_result.get("executive_summary", ""),
        priority_actions=analysis_result.get("priority_actions", []),
        learning_recommendations=analysis_result.get("learning_recommendations", []),
        certification_recommendations=analysis_result.get("certification_recommendations", []),
        project_recommendations=analysis_result.get("project_recommendations", []),
        cv_section_recommendations=analysis_result.get("cv_section_recommendations", []),
        score_breakdown=analysis_result.get("score_breakdown", {}),
        integrity_guardrail=analysis_result.get("integrity_guardrail", "passed"),
        cache_hit=False,
        cache_key_version=settings.gap_analysis_cache_version,
        created_at=new_analysis.created_at,
    )


@router.get("/history", response_model=list[GapAnalysisResponse])
async def get_analysis_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GapAnalysisResponse]:
    """Xem lại lịch sử các lượt phân tích Gap Analysis của người dùng."""
    stmt = select(CVAnalysis).where(CVAnalysis.user_id == current_user.id).order_by(CVAnalysis.created_at.desc())
    result = await db.execute(stmt)
    analyses = result.scalars().all()

    response_list = []
    for item in analyses:
        gap_data = item.gap_analysis_json or {}
        response_list.append(
            GapAnalysisResponse(
                id=item.id,
                cv_id=item.cv_id,
                jd_id=item.jd_id,
                cv_snapshot_id=item.cv_snapshot_id,
                jd_snapshot_id=item.jd_snapshot_id,
                pipeline_version=item.pipeline_version or gap_data.get("pipeline_version", "1.0"),
                trace_id=gap_data.get("trace_id", ""),
                match_id=gap_data.get("match_id", ""),
                candidate_id=gap_data.get("candidate_id", ""),
                document_id=gap_data.get("document_id", ""),
                status=gap_data.get("status", "COMPLETED"),
                match_score=item.match_score,
                final_score=gap_data.get("final_score", item.match_score),
                rating=gap_data.get("rating", "POOR"),
                mandatory_requirement_failed=gap_data.get("mandatory_requirement_failed", False),
                criteria=gap_data.get("criteria", []),
                requirements=gap_data.get("requirements", {}),
                evidence=gap_data.get("evidence", []),
                retrieval_results=gap_data.get("retrieval_results", []),
                cv_chunks=gap_data.get("cv_chunks", []),
                warnings=gap_data.get("warnings", []),
                versions=gap_data.get("versions", {}),
                processing_trace=gap_data.get("processing_trace", []),
                structured_cv=gap_data.get("structured_cv", {}),
                structured_jd=gap_data.get("structured_jd", {}),
                raw_match_score=gap_data.get("raw_match_score", item.match_score),
                match_level=gap_data.get("match_level", "partial_match"),
                confidence_score=gap_data.get("confidence_score", 0.0),
                confidence_level=gap_data.get("confidence_level", "low"),
                must_have_coverage=gap_data.get("must_have_coverage", 0.0),
                must_have_gate=gap_data.get("must_have_gate", {}),
                hard_skills_matching=gap_data.get("hard_skills_matching", []),
                hard_skills_partial=gap_data.get("hard_skills_partial", []),
                hard_skills_missing=gap_data.get("hard_skills_missing", []),
                soft_skills_gap=gap_data.get("soft_skills_gap", []),
                unknown_requirements=gap_data.get("unknown_requirements", []),
                requirement_evidence=gap_data.get("requirement_evidence", []),
                strengths=gap_data.get("strengths", []),
                risks=gap_data.get("risks", []),
                suggestions=item.optimized_suggestions_json or [],
                executive_summary=gap_data.get("executive_summary", ""),
                priority_actions=gap_data.get("priority_actions", []),
                learning_recommendations=gap_data.get("learning_recommendations", []),
                certification_recommendations=gap_data.get("certification_recommendations", []),
                project_recommendations=gap_data.get("project_recommendations", []),
                cv_section_recommendations=gap_data.get("cv_section_recommendations", []),
                score_breakdown=gap_data.get("score_breakdown", {}),
                integrity_guardrail=gap_data.get("integrity_guardrail", "passed"),
                created_at=item.created_at,
            )
        )
    return response_list


async def _owned_analysis(analysis_id: str, db: AsyncSession, user_id: str) -> CVAnalysis:
    result = await db.execute(select(CVAnalysis).where(CVAnalysis.id == analysis_id, CVAnalysis.user_id == user_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="MATCH_001: Không tìm thấy kết quả phân tích.")
    return analysis


@router.get("/{analysis_id}/evidence", response_model=list[dict])
async def get_match_evidence(
    analysis_id: str,
    requirement_id: str | None = Query(default=None),
    criterion_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return persisted evidence with optional requirement/criterion filters."""
    analysis = await _owned_analysis(analysis_id, db, current_user.id)
    data = analysis.gap_analysis_json or {}
    evidence = list(data.get("evidence", []))
    if requirement_id:
        evidence = [item for item in evidence if item.get("requirement_id") == requirement_id]
    if criterion_id:
        criterion = next(
            (item for item in data.get("criteria", []) if item.get("criterion_id") == criterion_id),
            None,
        )
        evidence_ids = set((criterion or {}).get("evidence_ids", []))
        evidence = [item for item in evidence if item.get("evidence_id") in evidence_ids]
    return evidence


@router.get("/{analysis_id}/report", response_model=dict)
async def get_match_report(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the complete persisted, versioned match report as JSON."""
    analysis = await _owned_analysis(analysis_id, db, current_user.id)
    data = dict(analysis.gap_analysis_json or {})
    return {
        "analysis_id": analysis.id,
        "cv_id": analysis.cv_id,
        "jd_id": analysis.jd_id,
        "match_score": analysis.match_score,
        **data,
    }


@router.post("/{analysis_id}/optimize", response_model=ResumeOptimizationResponse)
async def optimize_analysis_resume(
    analysis_id: str,
    payload: ResumeOptimizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeOptimizationResponse:
    """Generate a new evidence-checked optimization draft for one immutable CV-JD pair."""
    started_at = perf_counter()
    analysis = await _owned_analysis(analysis_id, db, current_user.id)
    cv_result = await db.execute(select(CV).where(CV.id == analysis.cv_id, CV.user_id == current_user.id))
    cv = cv_result.scalar_one_or_none()
    jd_result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == analysis.jd_id,
            or_(JobDescription.is_system.is_(True), JobDescription.created_by_user_id == current_user.id),
        )
    )
    jd = jd_result.scalar_one_or_none()
    if not cv or not jd:
        raise HTTPException(status_code=404, detail="CV hoặc JD của kết quả phân tích không còn tồn tại.")

    gap_data = dict(analysis.gap_analysis_json or {})
    stored_optimization_suggestions = list(analysis.optimized_suggestions_json or [])
    if stored_optimization_suggestions:
        gap_data["suggestions"] = stored_optimization_suggestions
    else:
        # The first optimization must keep the evidence-backed suggestions produced
        # by Gap Analysis. Replacing them with an empty persisted draft leaves the
        # deterministic fallback with no safe source when the LLM draft is rejected.
        gap_data["suggestions"] = list(gap_data.get("suggestions") or [])
    result = await optimize_resume_for_jd(
        cv_text=(cv.raw_text or cv.title or "").strip(),
        parsed_cv=dict(cv.parsed_json or {}),
        jd_title=jd.title or "Vị trí tuyển dụng",
        jd_text=(jd.requirements_text or jd.title or "").strip(),
        parsed_jd=dict(jd.normalized_json or {}),
        analysis=gap_data,
        language=payload.language,
        optimization_mode=payload.optimization_mode,
    )

    analysis.optimized_suggestions_json = [
        {
            "block_id": item["block_id"],
            "section": item["section"],
            "original_text": item["original"],
            "suggested_improvement": item["optimized"],
            "action_verb": item["optimized"].split(maxsplit=1)[0] if item["optimized"] else None,
            "reason": item["reason"],
            "jd_alignment": item["jd_alignment"],
            "evidence": item["evidence"],
            "fact_check_status": next(
                (claim["status"] for claim in result["fact_check"]["claims"] if claim["claim"] == item["optimized"]),
                "supported_rephrase",
            ),
            "requires_confirmation": item.get("requires_confirmation", False),
            "risk_flags": item.get("risk_flags", []),
        }
        for item in result["changes"]
    ]
    gap_data["resume_optimization"] = result
    analysis.gap_analysis_json = gap_data
    await db.execute(delete(CVOptimizationDecision).where(CVOptimizationDecision.analysis_id == analysis.id))
    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="resume_optimization",
            duration_ms=round((perf_counter() - started_at) * 1000),
            metadata_json={
                "cv_id": cv.id,
                "jd_id": jd.id,
                "analysis_id": analysis.id,
                "mode": payload.optimization_mode,
                "provider": result["provider"],
            },
        )
    )
    await db.commit()
    return ResumeOptimizationResponse.model_validate(result)


@router.put("/{analysis_id}/suggestions", response_model=CVOptimizationDecisionOut)
async def decide_optimization_suggestion(
    analysis_id: str,
    payload: CVOptimizationDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOptimizationDecisionOut:
    result = await db.execute(
        select(CVAnalysis).where(
            CVAnalysis.id == analysis_id,
            CVAnalysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả Gap Analysis.")
    suggestions = analysis.optimized_suggestions_json or []
    if payload.suggestion_index >= len(suggestions):
        raise HTTPException(status_code=422, detail="Gợi ý tối ưu không tồn tại.")
    source = suggestions[payload.suggestion_index]
    final_text = payload.final_text
    if payload.accepted and not final_text:
        final_text = source.get("suggested_improvement", "")
    if not payload.accepted:
        final_text = None
    if payload.accepted and final_text:
        cv_result = await db.execute(select(CV).where(CV.id == analysis.cv_id, CV.user_id == current_user.id))
        cv = cv_result.scalar_one_or_none()
        if not cv:
            raise HTTPException(status_code=404, detail="Không tìm thấy CV gốc để kiểm tra bằng chứng.")
        integrity_error = validate_resume_change(
            original=str(source.get("original_text") or ""),
            optimized=final_text,
            cv_text=(cv.raw_text or cv.title or "").strip(),
            parsed_cv=dict(cv.parsed_json or {}),
            missing_skills=list((analysis.gap_analysis_json or {}).get("hard_skills_missing", [])),
        )
        if integrity_error:
            raise HTTPException(status_code=422, detail=f"Gợi ý không vượt qua fact-check: {integrity_error}")

    existing_result = await db.execute(
        select(CVOptimizationDecision).where(
            CVOptimizationDecision.analysis_id == analysis.id,
            CVOptimizationDecision.suggestion_index == payload.suggestion_index,
        )
    )
    decision = existing_result.scalar_one_or_none()
    if decision:
        decision.accepted = payload.accepted
        decision.final_text = final_text
    else:
        decision = CVOptimizationDecision(
            user_id=current_user.id,
            cv_id=analysis.cv_id,
            analysis_id=analysis.id,
            suggestion_index=payload.suggestion_index,
            accepted=payload.accepted,
            final_text=final_text,
        )
        db.add(decision)
    await db.commit()
    await db.refresh(decision)
    return CVOptimizationDecisionOut.model_validate(decision)


@router.get("/{analysis_id}/suggestions", response_model=list[CVOptimizationDecisionOut])
async def list_optimization_decisions(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CVOptimizationDecisionOut]:
    result = await db.execute(
        select(CVOptimizationDecision)
        .where(
            CVOptimizationDecision.analysis_id == analysis_id,
            CVOptimizationDecision.user_id == current_user.id,
        )
        .order_by(CVOptimizationDecision.suggestion_index)
    )
    return [CVOptimizationDecisionOut.model_validate(item) for item in result.scalars().all()]
