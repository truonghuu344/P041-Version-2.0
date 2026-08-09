
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, CVAnalysis, CVOptimizationDecision, JobDescription, UsageEvent, User
from src.models.schemas import (
    CVOptimizationDecisionOut,
    CVOptimizationDecisionRequest,
    GapAnalysisRequest,
    GapAnalysisResponse,
)
from src.services.gap_analysis_service import perform_cv_jd_gap_analysis

router = APIRouter(prefix="/analysis", tags=["CV Match & Gap Analysis"])


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

    # Perform analysis
    analysis_result = await perform_cv_jd_gap_analysis(
        cv_raw_text=cv.raw_text or "",
        cv_parsed_json=cv.parsed_json or {},
        jd_title=jd.title,
        jd_requirements=jd.requirements_text,
    )

    # Save to database
    new_analysis = CVAnalysis(
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        match_score=analysis_result.get("match_score", 0.0),
        gap_analysis_json={
            "hard_skills_matching": analysis_result.get("hard_skills_matching", []),
            "hard_skills_missing": analysis_result.get("hard_skills_missing", []),
            "soft_skills_gap": analysis_result.get("soft_skills_gap", []),
            "executive_summary": analysis_result.get("executive_summary", ""),
            "priority_actions": analysis_result.get("priority_actions", []),
            "learning_recommendations": analysis_result.get("learning_recommendations", []),
            "certification_recommendations": analysis_result.get("certification_recommendations", []),
            "project_recommendations": analysis_result.get("project_recommendations", []),
            "cv_section_recommendations": analysis_result.get("cv_section_recommendations", []),
            "score_breakdown": analysis_result.get("score_breakdown", {}),
        },
        optimized_suggestions_json=analysis_result.get("suggestions", []),
    )
    db.add(new_analysis)
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
        match_score=new_analysis.match_score,
        hard_skills_matching=analysis_result.get("hard_skills_matching", []),
        hard_skills_missing=analysis_result.get("hard_skills_missing", []),
        soft_skills_gap=analysis_result.get("soft_skills_gap", []),
        suggestions=analysis_result.get("suggestions", []),
        executive_summary=analysis_result.get("executive_summary", ""),
        priority_actions=analysis_result.get("priority_actions", []),
        learning_recommendations=analysis_result.get("learning_recommendations", []),
        certification_recommendations=analysis_result.get("certification_recommendations", []),
        project_recommendations=analysis_result.get("project_recommendations", []),
        cv_section_recommendations=analysis_result.get("cv_section_recommendations", []),
        score_breakdown=analysis_result.get("score_breakdown", {}),
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
                match_score=item.match_score,
                hard_skills_matching=gap_data.get("hard_skills_matching", []),
                hard_skills_missing=gap_data.get("hard_skills_missing", []),
                soft_skills_gap=gap_data.get("soft_skills_gap", []),
                suggestions=item.optimized_suggestions_json or [],
                executive_summary=gap_data.get("executive_summary", ""),
                priority_actions=gap_data.get("priority_actions", []),
                learning_recommendations=gap_data.get("learning_recommendations", []),
                certification_recommendations=gap_data.get("certification_recommendations", []),
                project_recommendations=gap_data.get("project_recommendations", []),
                cv_section_recommendations=gap_data.get("cv_section_recommendations", []),
                score_breakdown=gap_data.get("score_breakdown", {}),
                created_at=item.created_at,
            )
        )
    return response_list


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
